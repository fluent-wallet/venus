package com.bsim

import android.os.Build
import com.ecp.tool.omachannel.ChannelImpl
import com.example.bsimlib.CoinType
import com.example.bsimlib.Message
import com.example.bsimlib.Sdk
import com.example.bsimlib.SdkCallBack
import com.example.bsimlib.Utils
import com.example.bsimlib.apdu.ApduParams
import com.example.bsimlib.apdu.ApduResponse
import com.example.bsimlib.apdu.ApduService
import com.example.bsimlib.apdu.CODE_6300
import com.example.bsimlib.apdu.CODE_SUCCESS
import com.facebook.common.logging.FLog
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException


class BSIMModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    init {
        reactContext.addLifecycleEventListener(this)
        FLog.setMinimumLoggingLevel(FLog.VERBOSE)
    }

    override fun getName(): String {
        return NAME
    }


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

    private var sdkInstance: Sdk? = null

    private val apduMutex = Mutex()
    private var apduService: ApduService? = null
    private var apduChannelOpen = false

    private fun ensureApduService(): ApduService {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            throw UnsupportedOperationException("APDU channel requires Android 9 (API 28) or higher")
        }
        val cached = apduService

        if (cached != null) {
            return cached
        }
        val service = ApduService()
        service.init(reactContext.applicationContext, object : ChannelImpl.CallBack {
            override fun success() {
                FLog.i(TAG_APDU, "OMA channel init success")
            }

            override fun failed(e: Exception) {
                FLog.e(TAG_APDU, "OMA channel init failed", e)
            }
        })
        apduService = service

        return service
    }

    @ReactMethod
    fun openApduChannel(promise: Promise) {
        scope.launch {
            try {
                apduMutex.withLock {
                    if (apduChannelOpen) {
                        promise.reject(ERROR_APDU_ALREADY_OPEN, "APDU channel is already open")
                        return@withLock
                    }

                    val service = ensureApduService()
                    val opend = try {
                        service.openChannel()
                    } catch (error: Exception) {
                        FLog.e(TAG_APDU, "openChannel threw", error)
                        promise.reject(ERROR_APDU_OPEN_FAILED, "Failed to open APDU channel")
                        return@withLock
                    }

                    if (!opend) {
                        promise.reject(ERROR_APDU_OPEN_FAILED, "APDU channel did not open")
                        return@withLock
                    }
                    apduChannelOpen = true
                    FLog.i(TAG_APDU, "APDU channel opend")
                    promise.resolve(null)
                }
            } catch (error: UnsupportedOperationException) {
                promise.reject(
                    ERROR_APDU_NOT_SUPPORTED,
                    error.message ?: "APDU transport not supported on this device"
                )
            } catch (error: Exception) {
                promise.reject(
                    ERROR_APDU_OPEN_FAILED,
                    "Unexpected error opening APDU channel:${error.message}"
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

                val service = apduService ?: run {
                    promise.reject(ERROR_APDU_NOT_OPEN, "APDU service is unavailable")
                    return@withLock
                }

                val normalized = try {
                    normalizeApduPayload(payload)
                } catch (error: IllegalArgumentException) {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        error.message ?: "Invalid APDU payload"
                    )
                    return@withLock
                }

                val params = try {
                    parseApduCommand(normalized)
                } catch (error: IllegalArgumentException) {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        error.message ?: "Malformed APDU command"
                    )
                    return@withLock
                }

                val response = try {
                    service.transmitApud(params)
                } catch (error: Exception) {
                    FLog.e(TAG_APDU, "transmitApud threw", error)
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        "Failed to transmit APDU: ${error.message}"
                    )
                    return@withLock
                }

                if (response == null) {
                    promise.reject(ERROR_APDU_TRANSMIT_FAILED, "APDU response is null")
                    return@withLock
                }

                val status = response.Code.uppercase(Locale.ROOT)
                if (status == CODE_SUCCESS || status == CODE_6300) {
                    val payloadHex = response.Message.orEmpty().uppercase(Locale.ROOT)
                    if (!isEvenLengthHex(payloadHex)) {
                        promise.reject(
                            ERROR_APDU_TRANSMIT_FAILED,
                            "APDU response payload is not hexadecimal"
                        )
                        return@withLock
                    }

                    val rawResponse = payloadHex + status
                    promise.resolve(rawResponse)
                } else {
                    promise.reject(
                        ERROR_APDU_TRANSMIT_FAILED,
                        "APDU command failed with status $status: ${response.Message}"
                    )
                }
            }
        }
    }


    @ReactMethod
    fun closeApduChannel(promise: Promise) {
        scope.launch {
            apduMutex.withLock {
                val service = apduService
                if (!apduChannelOpen || service == null) {
                    apduChannelOpen = false
                    promise.resolve(null)
                    return@withLock
                }

                try {
                    service.closeChannel()
                    FLog.i(TAG_APDU, "APDU channel closed")
                    resetApduState(releaseService = true)
                    promise.resolve(null)
                } catch (error: Exception) {
                    FLog.e(TAG_APDU, "closeChannel failed", error)
                    promise.reject(
                        ERROR_APDU_CLOSE_FAILED,
                        "Failed to close APDU channel: ${error.message}"
                    )
                }
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
        if (apdu.length < dataEnd) {
            throw IllegalArgumentException("APDU payload is truncated compared to LC")
        }

        val data = apdu.substring(dataStart, dataEnd)
        val le = apdu.substring(dataEnd)

        if (le.isNotEmpty() && !isEvenLengthHex(le)) {
            throw IllegalArgumentException("APDU LE field must be hexadecimal")
        }

        return ApduParams(cla, ins, p1, p2, lc, data, le)
    }

    private fun isHexChar(ch: Char): Boolean = (ch in '0'..'9') || (ch in 'A'..'F')

    private fun isEvenLengthHex(value: String): Boolean =
        value.isEmpty() || (value.length % 2 == 0 && value.all(::isHexChar))

    private fun resetApduState(releaseService: Boolean) {
        if (releaseService) {
            apduService = null
        }
        apduChannelOpen = false
    }

    private suspend fun createSDK(): Sdk {
        if (sdkInstance != null) {
            return sdkInstance as Sdk
        }

        return suspendCancellableCoroutine { continuation ->
            sdkInstance = Sdk(reactContext.applicationContext, object : SdkCallBack() {
                override fun success() {
                    FLog.i("BSIMDebug", "create success")
                    continuation.resume(
                        sdkInstance
                            ?: throw IllegalStateException("SDK was null when success was called")
                    )
                }

                override fun failed(e: Exception) {
                    if (continuation.isActive) {
                        FLog.i("BSIMDebug", "create failed")
                        continuation.resumeWithException(e)
                    }

                }
            })

        }
    }


    override fun onHostResume() {
    }

    override fun onHostPause() {
    }

    override fun onHostDestroy() {
        val shutdownJob = scope.launch {
            apduMutex.withLock {
                if (apduChannelOpen) {
                    try {
                        apduService?.closeChannel()
                    } catch (error: Exception) {
                        FLog.e(TAG_APDU, "closeChannel during destroy failed", error)
                    } finally {
                        resetApduState(releaseService = true)
                    }
                } else {
                    resetApduState(releaseService = true)
                }
            }

            sdkInstance?.closeChannel()
            sdkInstance = null
        }

        shutdownJob.invokeOnCompletion {
            scope.cancel()
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @ReactMethod
    fun getVersion(promise: Promise) {
        scope.launch {
            try {
                val instance = createSDK()
                val version = instance.getVersion()
                promise.resolve(version)
            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }

        }
    }

    @ReactMethod
    fun getBSIMVersion(promise: Promise) {
        scope.launch {
            try {
                val version = createSDK().getBSIMVersion() ?: run {
                    promise.reject(Errors.ErrorGetBSIMVersion.code, "get BSIM version failed")
                    return@launch
                }

                if (version.Code == CODE_SUCCESS) {
                    promise.resolve(version.Message)
                } else {
                    promise.reject(version.Code, version.Message)
                }


            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }
        }

    }


    @ReactMethod
    fun genNewKey(coinTypeString: String, promise: Promise) {
        scope.launch {
            val coin = CoinType.values().find { it.name == coinTypeString } ?: run {
                promise.reject(
                    Errors.ErrorNotSupportedCoinType.code, "the $coinTypeString is not supported"
                )
                return@launch
            }

            try {
                val result = createSDK().genNewKey(coin) ?: run {
                    promise.reject(
                        Errors.ErrorGenerateNewKey.code,
                        "create new key failed"
                    )
                    return@launch
                }

                if (result.Code == CODE_SUCCESS) {
                    promise.resolve("ok")
                } else {
                    promise.reject(
                        result.Code,
                        result.Message
                    )
                }
            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }

        }
    }

    private fun getEthAddressByPublicKey(publicKey: String): String {
        return when (publicKey.length) {
            130 -> {
                Keys.toChecksumAddress(Keys.getAddress(publicKey.substring(2)))
            }

            128 -> {
                Keys.toChecksumAddress(Keys.getAddress(publicKey))
            }

            else -> {
                throw IllegalArgumentException("Incorrect public key format")
            }
        }
    }


    @ReactMethod
    fun getPublicKeyAndAddress(promise: Promise) {
        scope.launch {
            try {
                val publicKeyResponse = createSDK().getPubkeyList()
                if (publicKeyResponse.Code !== CODE_SUCCESS) {
                    promise.reject(publicKeyResponse.Code, publicKeyResponse.Message)
                } else {
                    val result = WritableNativeArray()

                    for (publicKey in publicKeyResponse.PubkeyList) {
                        val temp = WritableNativeMap()
                        if (publicKey.coinType == CoinType.ETHEREUM.index) {
                            temp.putString("address", getEthAddressByPublicKey(publicKey.key))
                        }

                        temp.putInt("coinType", publicKey.coinType)
                        temp.putInt("index", publicKey.index)
                        temp.putString("key", publicKey.key)
                        result.pushMap(temp)
                    }
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }
        }
    }

    @ReactMethod
    fun signMessage(msg: String, coinTypeIndex: Int, publicKeyIndex: Int, promise: Promise) {
        scope.launch {
            val coinType = CoinType.values().find { it.index == coinTypeIndex }
                ?: run {
                    promise.reject(Errors.ErrorSignCoinTypeNotFind.code, "error coin type index")
                    return@launch
                }

            val sdk = createSDK()
            val message = Message(
                msg = Numeric.hexStringToByteArray(msg),
                coinType = coinType,
                index = publicKeyIndex.toUInt()
            )

            val signMsg = sdk.signMessage(message)
                ?: run {
                    promise.reject(Errors.ErrorSignMessage.code, "sign message failed")
                    return@launch
                }

            if (signMsg.Code != CODE_SUCCESS) {
                promise.reject(signMsg.Code, signMsg.Message)
                return@launch
            }

            val publicKeyList = sdk.getPubkeyList()

            val pubKey = publicKeyList.PubkeyList.find { it.index == publicKeyIndex }
                ?: run {
                    promise.reject(
                        Errors.ErrorSignGetPublicKey.code, "no public key index match"
                    )
                    return@launch
                }

            val result = WritableNativeMap()
            val ecSgn = Utils.Companion.hexRSToECDSASignature(signMsg.R, signMsg.S)
            val signature = Utils.createSignatureData(
                ecSgn,
                Utils.getECKeyFromString(pubKey.key),
                Numeric.hexStringToByteArray(msg)
            )

            if (signature == null) {
                promise.reject(
                    Errors.ErrorSignMessage.code,
                    "signature data from hex error"
                )
                return@launch
            }

            result.putString("code", signMsg.Code)
            result.putString("message", signMsg.Message)
            result.putString("r", Numeric.toHexString(signature.r))
            result.putString("s", Numeric.toHexString(signature.s))
            result.putString("v", Numeric.toHexString(signature.v))
            promise.resolve(result)
        }
    }

    private fun executeAndHandlePromise(
        function: () -> ApduResponse?, promise: Promise, errorCode: String, errorMessage: String
    ) {
        scope.launch {
            try {
                val result = function() ?: run {
                    promise.reject(errorCode, errorMessage)
                    return@launch
                }

                if (result.Code == CODE_SUCCESS) {
                    promise.resolve(result.Message)
                } else {
                    promise.reject(result.Code, result.Message)
                }

            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }
        }
    }

    @ReactMethod
    fun verifyBPIN(promise: Promise) {
        scope.launch {
            executeAndHandlePromise(
                createSDK()::verifyBPIN, promise, Errors.ErrorVerifyBPIN.code, "verify BPIN failed"
            )
        }
    }

    @ReactMethod
    fun updateBPIN(promise: Promise) {
        scope.launch {
            executeAndHandlePromise(
                createSDK()::updateBPIN, promise, Errors.ErrorUpdateBPIN.code, "update BPIN failed"
            )
        }
    }

}
