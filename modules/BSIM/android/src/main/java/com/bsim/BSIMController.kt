package com.bsim

import android.content.Context
import android.os.Build
import android.util.Log
import com.ecp.tool.omachannel.ChannelImpl
import com.ecp.tool.omachannel.OmaApduService
import com.ecp.tool.omachannel.common.ELogImpl
import com.ecp.tool.omachannel.common.log.ELog
import com.example.bsimlib.apdu.ApduParams
import com.example.bsimlib.apdu.ApduResponse
import com.example.bsimlib.apdu.CODE_6300
import com.example.bsimlib.apdu.CODE_SUCCESS
import com.example.bsimlib.apdu.getResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.Locale

internal class BSIMController(context: Context) {
    private val applicationContext = context.applicationContext

    companion object {
        private const val TAG_APDU = "BSIMApdu"
        private const val ERROR_APDU_NOT_SUPPORTED = "APDU_NOT_SUPPORTED"
        private const val ERROR_APDU_NOT_OPEN = "APDU_NOT_OPEN"
        private const val ERROR_APDU_OPEN_FAILED = "APDU_OPEN_FAILED"
        private const val ERROR_APDU_TRANSMIT_FAILED = "APDU_TRANSMIT_FAILED"
        private const val ERROR_APDU_CLOSE_FAILED = "APDU_CLOSE_FAILED"
    }

    // Keep hardware operations and cleanup in the same controller-owned IO scope.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val apduMutex = Mutex()

    private data class ApduContext(
        val aid: String,
        var channel: ChannelImpl? = null,
        var initState: CompletableDeferred<Unit>? = null,
        var channelOpen: Boolean = false,
    )

    private val apduContexts = mutableMapOf<String, ApduContext>()
    private var currentAid: String? = null

    init {
        ELog.setLog(ELogImpl())
    }

    private suspend fun ensureOmaChannel(aid: String): ChannelImpl {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            throw UnsupportedOperationException("APDU channel requires Android 9 (API 28) or higher")
        }

        val compactAid = aid.filterNot(Char::isWhitespace).uppercase(Locale.ROOT)
        if (compactAid.isEmpty()) {
            throw IllegalArgumentException("AID must not be empty")
        }
        if (compactAid.length % 2 != 0) {
            throw IllegalArgumentException("AID must contain whole bytes")
        }
        if (!compactAid.all(::isHexChar)) {
            throw IllegalArgumentException("AID must be hexadecimal")
        }

        val context = apduContexts.getOrPut(compactAid) { ApduContext(compactAid) }
        val cachedChannel = context.channel
        val cachedInit = context.initState

        if (cachedChannel != null && cachedInit != null) {
            try {
                cachedInit.await()
                return cachedChannel
            } catch (error: Exception) {
                resetApduContext(context, releaseChannel = true)
                throw error
            }
        }

        val channel = OmaApduService(applicationContext).aid(compactAid)

        val initState = CompletableDeferred<Unit>()
        context.channel = channel
        context.initState = initState

        channel.init(object : ChannelImpl.CallBack {
            override fun success() {
                Log.i(TAG_APDU, "OMA channel init success for AID $compactAid")
                if (!initState.isCompleted) {
                    initState.complete(Unit)
                }
            }

            override fun failed(e: Exception) {
                Log.e(TAG_APDU, "OMA channel init failed for AID $compactAid", e)
                if (!initState.isCompleted) {
                    initState.completeExceptionally(e)
                }
            }
        })

        try {
            initState.await()
        } catch (error: Exception) {
            resetApduContext(context, releaseChannel = true)
            throw error
        }

        return channel
    }

    suspend fun openApduChannel(aid: String): Unit = scope.async<Unit> {
        try {
            apduMutex.withLock {
                val compactAid = aid.filterNot(Char::isWhitespace).uppercase(Locale.ROOT)
                if (compactAid.isEmpty()) {
                    throw BSIMException(ERROR_APDU_OPEN_FAILED, "AID must not be empty")
                }
                if (compactAid.length % 2 != 0 || !compactAid.all(::isHexChar)) {
                    throw BSIMException(ERROR_APDU_OPEN_FAILED, "AID must be even-length hexadecimal")
                }

                val context = apduContexts.getOrPut(compactAid) { ApduContext(compactAid) }
                if (context.channelOpen) {
                    Log.i(TAG_APDU, "APDU channel already open for AID $compactAid, reusing")
                    currentAid = compactAid
                    return@withLock
                }

                val channel = try {
                    ensureOmaChannel(compactAid)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: UnsupportedOperationException) {
                    throw BSIMException(ERROR_APDU_NOT_SUPPORTED,
                        error.message ?: "APDU transport not supported on this device", error)
                } catch (error: Exception) {
                    throw BSIMException(ERROR_APDU_OPEN_FAILED,
                        error.message ?: "Failed to initialise APDU channel", error)
                }

                val opened = try {
                    channel.openChannel()
                } catch (error: Exception) {
                    Log.e(TAG_APDU, "openChannel threw", error)
                    throw BSIMException(ERROR_APDU_OPEN_FAILED, "Failed to open APDU channel", error)
                }
                if (!opened) {
                    throw BSIMException(ERROR_APDU_OPEN_FAILED, "APDU channel did not open")
                }

                context.channelOpen = true
                currentAid = compactAid
                Log.i(TAG_APDU, "APDU channel opened for AID $compactAid")
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: BSIMException) {
            throw error
        } catch (error: UnsupportedOperationException) {
            throw BSIMException(ERROR_APDU_NOT_SUPPORTED,
                error.message ?: "APDU transport not supported on this device", error)
        } catch (error: Exception) {
            throw BSIMException(ERROR_APDU_OPEN_FAILED,
                "Unexpected error opening APDU channel: ${error.message}", error)
        }
    }.await()

    suspend fun transmitApdu(payload: String): String = scope.async {
        apduMutex.withLock {
            val activeAid = currentAid
                ?: throw BSIMException(ERROR_APDU_NOT_OPEN, "APDU channel is not open")
            val context = apduContexts[activeAid]
            if (context == null || !context.channelOpen) {
                throw BSIMException(ERROR_APDU_NOT_OPEN, "APDU channel is not open")
            }
            val channel = context.channel
                ?: throw BSIMException(ERROR_APDU_NOT_OPEN, "APDU channel is unavailable")

            val command = try {
                normalizeApduPayload(payload)
            } catch (error: IllegalArgumentException) {
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED,
                    error.message ?: "Invalid APDU payload", error)
            }
            val params = try {
                parseApduCommand(command)
            } catch (error: IllegalArgumentException) {
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED,
                    error.message ?: "Malformed APDU command", error)
            }

            val rawResponse = try {
                channel.transmitAPDU(params.toParamStr().uppercase(Locale.ROOT))
            } catch (error: Exception) {
                Log.e(TAG_APDU, "transmitAPDU threw", error)
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED,
                    "Failed to transmit APDU: ${error.message}", error)
            } ?: throw BSIMException(ERROR_APDU_TRANSMIT_FAILED, "APDU response is null")

            val response: ApduResponse = try {
                getResult(rawResponse)
            } catch (error: Exception) {
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED,
                    error.message ?: "Failed to parse APDU response", error)
            }
            val status = response.Code.uppercase(Locale.ROOT)
            if (status != CODE_SUCCESS && status != CODE_6300) {
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED,
                    "APDU command failed with status $status: ${response.Message}")
            }
            val payloadHex = response.Message.orEmpty().uppercase(Locale.ROOT)
            if (!isEvenLengthHex(payloadHex)) {
                throw BSIMException(ERROR_APDU_TRANSMIT_FAILED, "APDU response payload is not hexadecimal")
            }
            payloadHex + status
        }
    }.await()

    suspend fun closeApduChannel(): Unit = scope.async<Unit> {
        apduMutex.withLock {
            val activeAid = currentAid ?: return@withLock
            val context = apduContexts[activeAid]
            val channel = context?.channel
            if (context == null || !context.channelOpen || channel == null) {
                context?.channelOpen = false
                if (currentAid == activeAid) currentAid = null
                return@withLock
            }

            try {
                channel.closeChannel()
                Log.i(TAG_APDU, "APDU channel closed for AID $activeAid")
            } catch (error: Exception) {
                Log.e(TAG_APDU, "closeChannel failed", error)
                throw BSIMException(ERROR_APDU_CLOSE_FAILED,
                    "Failed to close APDU channel: ${error.message}", error)
            } finally {
                resetApduContext(context, releaseChannel = true)
                if (currentAid == activeAid) currentAid = null
            }
        }
    }.await()

    private fun normalizeApduPayload(raw: String): String {
        val compact = raw.filterNot(Char::isWhitespace)
        if (compact.isEmpty()) {
            throw IllegalArgumentException("APDU payload must not be empty")
        }
        if (compact.length % 2 != 0) {
            throw IllegalArgumentException("APDU payload must contain whole bytes")
        }

        val uppercase = compact.uppercase(Locale.ROOT)
        if (!uppercase.all(::isHexChar)) {
            throw IllegalArgumentException("APDU payload must be hexadecimal")
        }
        return uppercase
    }

    private fun parseApduCommand(apdu: String): ApduParams {
        if (apdu.length < 10) {
            throw IllegalArgumentException("APDU payload is too short")
        }

        val cla = apdu.substring(0, 2)
        val ins = apdu.substring(2, 4)
        val p1 = apdu.substring(4, 6)
        val p2 = apdu.substring(6, 8)
        val lc = apdu.substring(8, 10)

        val dataByteLength = lc.toInt(16)
        val dataStart = 10
        val dataEnd = dataStart + dataByteLength * 2

        val hasCompleteData = apdu.length >= dataEnd
        val data = if (hasCompleteData) {
            apdu.substring(dataStart, dataEnd)
        } else {
            if (dataByteLength > 0 && apdu.length > dataStart) {
                throw IllegalArgumentException("APDU payload is truncated compared to LC")
            }
            ""
        }

        val leStart = if (hasCompleteData) dataEnd else apdu.length
        val le = apdu.substring(leStart)

        if (le.isNotEmpty() && !isEvenLengthHex(le)) {
            throw IllegalArgumentException("APDU LE field must be hexadecimal")
        }

        return ApduParams(cla, ins, p1, p2, lc, data, le)
    }

    private fun isHexChar(ch: Char): Boolean = (ch in '0'..'9') || (ch in 'A'..'F')

    private fun isEvenLengthHex(value: String): Boolean =
        value.isEmpty() || (value.length % 2 == 0 && value.all(::isHexChar))

    private fun resetApduContext(context: ApduContext, releaseChannel: Boolean) {
        if (releaseChannel) {
            try {
                (context.channel as? OmaApduService)?.close()
            } catch (error: Exception) {
                Log.e(
                    TAG_APDU, "close during resetApduContext failed for AID ${context.aid}", error
                )
            }
        }

        context.channel = null
        apduContexts.remove(context.aid)

        context.initState?.cancel()
        context.initState = null
        context.channelOpen = false
    }

    private fun resetAllApduContexts() {
        apduContexts.values.forEach { ctx ->
            try {
                ctx.channel?.close()
            } catch (error: Exception) {
                Log.e(
                    TAG_APDU, "close during resetAllApduContexts failed for AID ${ctx.aid}", error
                )
            } finally {
                ctx.initState?.cancel()
            }
        }
        apduContexts.clear()
        currentAid = null
    }

    fun releaseChannels() = scope.launch {
        apduMutex.withLock {
            resetAllApduContexts()
        }
    }

    fun dispose() {
        releaseChannels().invokeOnCompletion { scope.cancel() }
    }
}
