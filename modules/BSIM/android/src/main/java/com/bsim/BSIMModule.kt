package com.bsim

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.example.bsimlib.Sdk
import com.example.bsimlib.CoinType
import com.example.bsimlib.Message
import com.example.bsimlib.SdkCallBack
import com.example.bsimlib.Utils
import com.example.bsimlib.apdu.ApduResponse
import com.example.bsimlib.apdu.CODE_SUCCESS
import com.facebook.common.logging.FLog
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric

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
    }

    private var sdkInstance: Sdk? = null

    private suspend fun createSDK(): Sdk {
        if (sdkInstance != null) {
            return sdkInstance as Sdk
        }

        return suspendCoroutine { continuation ->
            sdkInstance = Sdk(reactContext.applicationContext, object : SdkCallBack() {
                override fun success() {
                    FLog.i("BSIMDebug", "create success")
                    continuation.resume(
                        sdkInstance
                            ?: throw IllegalStateException("SDK was null when success was called")
                    )
                }

                override fun failed(e: Exception) {
                    FLog.i("BSIMDebug", "create failed")
                    throw e
                }
            })

        }
    }


    override fun onHostResume() {
    }

    override fun onHostPause() {
    }

    override fun onHostDestroy() {
        if (sdkInstance != null) {
            sdkInstance!!.closeChannel()
            sdkInstance = null
        }

        scope.cancel()
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
                val version = createSDK().getBSIMVersion()
                version?.let {
                    if (it.Code == CODE_SUCCESS) {
                        promise.resolve(it.Message)
                    } else {
                        promise.reject(it.Code, it.Message)
                    }

                } ?: run {
                    promise.reject(Errors.ErrorGetBSIMVersion.code, "get BSIM version failed")
                }

            } catch (e: Exception) {
                promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
            }
        }

    }


    @ReactMethod
    fun genNewKey(coinTypeString: String, promise: Promise) {
        scope.launch {
            val coin = CoinType.entries.find { it.name == coinTypeString }

            coin?.let {
                try {
                    val result = createSDK().genNewKey(it)
                    if (result?.Code == CODE_SUCCESS) {
                        promise.resolve("ok")
                    } else {
                        promise.reject(
                            result?.Code ?: Errors.ErrorGenerateNewKey.code,
                            result?.Message ?: "create new key failed"
                        )
                    }
                } catch (e: Exception) {
                    promise.reject(Errors.ErrorUnknown.code, "unknown error ${e.message}")
                }
            } ?: run {
                promise.reject(
                    Errors.ErrorNotSupportedCoinType.code, "the $coinTypeString is not supported"
                )
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
                val publicKeyResponse = createSDK().getPubkeyList();
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
            val coinType = CoinType.entries.find { it.index == coinTypeIndex }
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
                val result = function()
                result?.let {
                    if (it.Code == CODE_SUCCESS) {
                        promise.resolve(it.Message)
                    } else {
                        promise.reject(it.Code, it.Message)
                    }
                } ?: run {
                    promise.reject(errorCode, errorMessage)
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
