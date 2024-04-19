package tech.swiftshield.bsimsdk

import com.example.bsimlib.Sdk
import com.example.bsimlib.CoinType
import com.example.bsimlib.Message
import com.example.bsimlib.SdkCallBack
import com.example.bsimlib.Utils
import com.example.bsimlib.apdu.CODE_SUCCESS

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.common.logging.FLog;

import org.web3j.utils.Numeric

class SDKModule(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    init {
        FLog.setMinimumLoggingLevel(FLog.DEBUG)
    }

    override fun getName(): String {
        return "BSIMSDK"
    }

    private var sdk: Sdk? = null
    private val nonInstanced = "400";
    private val nonInstancedMsg = "BSIMSDK is not create, Please call createMockSDK function first"



    private val failedCreate = "401"

    @ReactMethod
    fun create(promise: Promise) {

        if (sdk == null) {
            try {
                FLog.d("BSIMDebug", "start to init sdk")
                sdk = Sdk(reactContext.applicationContext, object : SdkCallBack() {
                    override fun success() {
                        FLog.d("BSIMDebug", "create success")
                        promise.resolve(null);
                    }

                    override fun failed(e: Exception) {
                        FLog.d("BSIMDebug", "create failed")
                        val failed = "init failed: $e"
                        promise.reject(failedCreate, failed)
                    }
                })
            } catch (e: Exception) {
                FLog.d("BSIMDebug", e.stackTraceToString());
                promise.reject(failedCreate, "initialization BSIM SDK failed，please try again")
            }
        } else {
            promise.resolve("");
        }
    }

    private val failedGenNewKey = "402"

    @ReactMethod
    fun genNewKey(coinTypeString: String, promise: Promise) {

        val coinType: CoinType = try {
            CoinType.valueOf(coinTypeString)
        } catch (e: IllegalArgumentException) {
            CoinType.CONFLUX
        }

        val result = sdk?.genNewKey(coinType)

        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve("ok")
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject(failedGenNewKey, "BSIM create new key failed")
        }
    }

    private val failedGetPubKeyList = "403"

    @ReactMethod
    fun getPubkeyList(promise: Promise) {
        if (sdk == null) {
            promise.reject(nonInstanced, nonInstancedMsg)
            return
        }
        val pubkeyListResult = sdk?.getPubkeyList()

        if (pubkeyListResult != null) {
            if (pubkeyListResult.Code === CODE_SUCCESS) {
                val resultList = WritableNativeArray()
                for (key in pubkeyListResult.PubkeyList) {
                    val temp = WritableNativeMap()
                    temp.putInt("coinType", key.coinType)
                    temp.putString("key", key.key)
                    temp.putInt("index", key.index)
                    resultList.pushMap(temp)
                }
                promise.resolve(resultList)
            } else {
                promise.reject(pubkeyListResult.Code, pubkeyListResult.Message)
            }
        } else {
            promise.reject(failedGetPubKeyList, "get pubkey list error");
        }
    }

    private  val failedSignMsg = "404"
    @ReactMethod
    fun signMessage(msg: String, coinTypeIndex: Int, index: Int, promise: Promise) {
        // 校验BPIN
        // !! 签名前必须先校验BPIN，verifyBPIN调用或立刻返回，BSIM卡拉起输入界面，
        // !! 输入结果BSIM卡自动校验，提示用户，APP拿不到校验结果，app不参与BPIN相关流程
        // !! 校验失败后sign时会有提示

        val coinType = CoinType.entries.find { it.index == coinTypeIndex }

        if (coinType === null) {
            return promise.reject(failedSignMsg, "coin type not find")
        }

        var keyList = sdk?.getPubkeyList()

        val message = Message(
                msg = Numeric.hexStringToByteArray(msg),
                coinType = coinType,
                index = index.toUInt()
        )

        val signMsg = sdk?.signMessage(message)

        if (signMsg != null && keyList != null) {
            val pubKey = keyList.PubkeyList.find { it.index == index }

            if (pubKey != null) {
                if (signMsg.Code == CODE_SUCCESS) {
                    val result = WritableNativeMap()
                    val ecSgn = Utils.Companion.hexRSToECDSASignature(signMsg.R, signMsg.S)
                    val signature = Utils.createSignatureData(
                            ecSgn,
                            Utils.getECKeyFromString(pubKey.key),
                            Numeric.hexStringToByteArray(msg)
                    )
                    if (signature != null) {
                        result.putString("code", signMsg.Code)
                        result.putString("message", signMsg.Message)
                        result.putString("r", Numeric.toHexString(signature.r))
                        result.putString("s", Numeric.toHexString(signature.s))
                        result.putString("v", Numeric.toHexString(signature.v))
                        promise.resolve(result)

                    } else {
                        promise.reject(failedSignMsg, "signature data from hex error")
                    }

                } else {
                    promise.reject(signMsg.Code, signMsg.Message)
                }
            }
        }
    }


    @ReactMethod
    fun closeChannel() {
        if (sdk != null) {
            sdk?.closeChannel()
        }
    }
    private val failedGetBSIMVersion = "405"
    @ReactMethod
    fun getBSIMVersion(promise: Promise) {
        if (sdk == null) {
            promise.reject(nonInstanced, nonInstancedMsg)
            return
        }
        val result = sdk?.getBSIMVersion();
        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve(result.Message)
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject(failedGetBSIMVersion, "get BSIM version failed")
        }
    }

    private  val failedGetSDKVersion = "406"
    @ReactMethod
    fun getVersion(promise: Promise) {
        if (sdk == null) {
            promise.reject(nonInstanced, nonInstancedMsg)
            return
        }

        val result = sdk?.getVersion()
        if (result != null) {
            promise.resolve(result)
        } else {
            promise.reject(failedGetSDKVersion, "get the SDK version failed")
        }
    }

    private  val failedVerifyBPIN = "407"
    @ReactMethod
    fun verifyBPIN(promise: Promise) {
        if (sdk == null) {
            promise.reject(nonInstanced, nonInstancedMsg)
            return
        }
        var result = sdk?.verifyBPIN();

        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve(result.Message)
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject(failedVerifyBPIN, "verify BPIN failed")
        }

    }

    @ReactMethod
    fun updateBPIN(promise: Promise) {
        if (sdk == null) {
            promise.reject(nonInstanced, nonInstancedMsg)
            return
        }
        sdk?.updateBPIN()
    }

}