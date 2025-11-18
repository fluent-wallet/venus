package com.bsim

import android.os.Build
import com.ecp.tool.omachannel.ChannelImpl
import com.ecp.tool.omachannel.OmaApduService
import com.ecp.tool.omachannel.common.ELogImpl
import com.ecp.tool.omachannel.common.log.ELog
import com.example.bsimlib.apdu.ApduParams
import com.example.bsimlib.apdu.ApduResponse
import com.example.bsimlib.apdu.CODE_6300
import com.example.bsimlib.apdu.CODE_SUCCESS
import com.example.bsimlib.apdu.getResult
import com.facebook.common.logging.FLog
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.Locale

class BSIMModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val NAME = "BSIM"

        private const val TAG_APDU = "BSIMApdu"
        private const val ERROR_APDU_NOT_SUPPORTED = "APDU_NOT_SUPPORTED"
        private const val ERROR_APDU_ALREADY_OPEN = "APDU_ALREADY_OPEN"
        private const val ERROR_APDU_NOT_OPEN = "APDU_NOT_OPEN"
        private const val ERROR_APDU_OPEN_FAILED = "APDU_OPEN_FAILED"
        private const val ERROR_APDU_TRANSMIT_FAILED = "APDU_TRANSMIT_FAILED"
        private const val ERROR_APDU_CLOSE_FAILED = "APDU_CLOSE_FAILED"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val apduMutex = Mutex()
    private var omaChannel: ChannelImpl? = null
    private var apduInitState: CompletableDeferred<Unit>? = null
    private var apduChannelOpen = false
    private var currentAid: String? = null

    init {
        reactContext.addLifecycleEventListener(this)
        FLog.setMinimumLoggingLevel(FLog.VERBOSE)
    }

    override fun getName(): String = NAME

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


        val cachedChannel = omaChannel
        val cachedInit = apduInitState


        if (cachedChannel != null && cachedInit != null && currentAid == compactAid) {
            try {
                cachedInit.await()
                return cachedChannel
            } catch (error: Exception) {
                resetApduState(true)
                throw error
            }
        }

        ELog.setLog(ELogImpl())

        val channel = OmaApduService
            .getInstance(reactContext.applicationContext)
            .aid(compactAid)

        val initState = CompletableDeferred<Unit>()
        omaChannel = channel
        apduInitState = initState
        currentAid = compactAid


        channel.init(object : ChannelImpl.CallBack {
            override fun success() {
                FLog.i(TAG_APDU, "OMA channel init success for AID $compactAid")
                if (!initState.isCompleted) {
                    initState.complete(Unit)
                }
            }

            override fun failed(e: Exception) {
                FLog.e(TAG_APDU, "OMA channel init failed for AID $compactAid", e)
                if (!initState.isCompleted) {
                    initState.completeExceptionally(e)
                }
            }
        })

        try {
            initState.await()
        } catch (error: Exception) {
            resetApduState(true)
            throw error
        }

        return channel

    }


    @ReactMethod
    fun openApduChannel(aid: String, promise: Promise) {
        scope.launch {
            try {
                apduMutex.withLock {
                    val compactAid = aid.filterNot(Char::isWhitespace).uppercase(Locale.ROOT)
                    if (compactAid.isEmpty()) {
                        promise.reject(ERROR_APDU_OPEN_FAILED, "AID must not be empty")
                        return@withLock
                    }
                    if (compactAid.length % 2 != 0 || !compactAid.all(::isHexChar)) {
                        promise.reject(
                            ERROR_APDU_OPEN_FAILED,
                            "AID must be even-length hexadecimal"
                        )
                        return@withLock
                    }

                    if (apduChannelOpen && currentAid == compactAid) {
                        FLog.i(TAG_APDU, "APDU channel already open for AID $compactAid, reusing")
                        promise.resolve(null)
                        return@withLock
                    }

                    if (apduChannelOpen && currentAid != compactAid) {
                        try {
                            omaChannel?.closeChannel()
                            FLog.i(TAG_APDU, "Closed previous APDU channel for AID $currentAid")
                        } catch (error: Exception) {
                            FLog.e(TAG_APDU, "closeChannel before AID switch failed", error)
                        } finally {
                            resetApduState(true)
                        }
                    }

                    val channel = try {
                        ensureOmaChannel(compactAid)
                    } catch (error: UnsupportedOperationException) {
                        promise.reject(
                            ERROR_APDU_NOT_SUPPORTED,
                            error.message ?: "APDU transport not supported on this device",
                        )
                        return@withLock
                    } catch (error: Exception) {
                        promise.reject(
                            ERROR_APDU_OPEN_FAILED,
                            error.message ?: "Failed to initialise APDU channel",
                        )
                        return@withLock
                    }

                    val opened = try {
                        channel.openChannel()
                    } catch (error: Exception) {
                        FLog.e(TAG_APDU, "openChannel threw", error)
                        promise.reject(ERROR_APDU_OPEN_FAILED, "Failed to open APDU channel")
                        return@withLock
                    }

                    if (!opened) {
                        promise.reject(ERROR_APDU_OPEN_FAILED, "APDU channel did not open")
                        return@withLock
                    }

                    apduChannelOpen = true
                    currentAid = compactAid
                    FLog.i(TAG_APDU, "APDU channel opened for AID $compactAid")
                    promise.resolve(null)
                }
            } catch (error: UnsupportedOperationException) {
                promise.reject(
                    ERROR_APDU_NOT_SUPPORTED,
                    error.message ?: "APDU transport not supported on this device",
                )
            } catch (error: Exception) {
                promise.reject(
                    ERROR_APDU_OPEN_FAILED,
                    "Unexpected error opening APDU channel: ${error.message}",
                )
            }
        }
    }

    @ReactMethod
    fun transmitApdu(payload: String, promise: Promise) {
        scope.launch {
            apduMutex.withLock {
                if (!apduChannelOpen) {
                    promise.reject(ERROR_APDU_NOT_OPEN, "APDU channel is not open")
                    return@withLock
                }

                val channel = omaChannel ?: run {
                    promise.reject(ERROR_APDU_NOT_OPEN, "APDU channel is unavailable")
                    return@withLock
                }

                val normalized = try {
                    normalizeApduPayload(payload)
                } catch (error: IllegalArgumentException) {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        error.message ?: "Invalid APDU payload",
                    )
                    return@withLock
                }

                val params = try {
                    parseApduCommand(normalized)
                } catch (error: IllegalArgumentException) {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        error.message ?: "Malformed APDU command",
                    )
                    return@withLock
                }

                val rawResponse = try {
                    channel.transmitAPDU(params.toParamStr().uppercase(Locale.ROOT))
                } catch (error: Exception) {
                    FLog.e(TAG_APDU, "transmitAPDU threw", error)
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        "Failed to transmit APDU: ${error.message}",
                    )
                    return@withLock
                } ?: run {
                    promise.reject(ERROR_APDU_TRANSMIT_FAILED, "APDU response is null")
                    return@withLock
                }

                val response: ApduResponse = try {
                    getResult(rawResponse)
                } catch (error: Exception) {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        error.message ?: "Failed to parse APDU response",
                    )
                    return@withLock
                }

                val status = response.Code.uppercase(Locale.ROOT)
                if (status == CODE_SUCCESS || status == CODE_6300) {
                    val payloadHex = response.Message.orEmpty().uppercase(Locale.ROOT)
                    if (!isEvenLengthHex(payloadHex)) {
                        promise.reject(
                            ERROR_APDU_TRANSMIT_FAILED,
                            "APDU response payload is not hexadecimal",
                        )
                        return@withLock
                    }

                    val raw = payloadHex + status
                    promise.resolve(raw)
                } else {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        "APDU command failed with status $status: ${response.Message}",
                    )
                }


            }
        }
    }

    @ReactMethod
    fun closeApduChannel(promise: Promise) {
        scope.launch {
            apduMutex.withLock {
                val channel = omaChannel
                if (!apduChannelOpen || channel == null) {
                    apduChannelOpen = false
                    promise.resolve(null)
                    return@withLock
                }

                try {
                    channel.closeChannel()
                    FLog.i(TAG_APDU, "APDU channel closed")
                } catch (error: Exception) {
                    FLog.e(TAG_APDU, "closeChannel failed", error)
                    promise.reject(
                        ERROR_APDU_CLOSE_FAILED,
                        "Failed to close APDU channel: ${error.message}",
                    )
                    return@withLock
                } finally {
                    resetApduState(true)
                }

                promise.resolve(null)
            }
        }
    }

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

    private fun resetApduState(releaseChannel: Boolean) {
        if (releaseChannel) {
            omaChannel = null
            currentAid = null
        }
        apduInitState?.cancel()
        apduInitState = null
        apduChannelOpen = false
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        val shutdownJob = scope.launch {
            apduMutex.withLock {
                if (apduChannelOpen) {
                    try {
                        omaChannel?.closeChannel()
                    } catch (error: Exception) {
                        FLog.e(TAG_APDU, "closeChannel during destroy failed", error)
                    }
                }
                resetApduState(true)
            }
        }

        shutdownJob.invokeOnCompletion { scope.cancel() }
    }
}