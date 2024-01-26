package com.wallet.bsimsdk

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

    override fun getName(): String {
        return "BSIMSDK"
    }


    private var BSIMSDKInstance: Sdk? = null

    private val error =
        mapOf("400" to "BSIMSDK is not create, Please call createMockSDK function first")

    private var BSIM_ERRPR = "BSIM_ERROR"

    @ReactMethod
    fun create(promise: Promise) {
        FLog.setMinimumLoggingLevel(FLog.DEBUG)
        if (BSIMSDKInstance == null) {
            BSIMSDKInstance = Sdk(reactContext.applicationContext, object : SdkCallBack() {
                override fun success() {
                    FLog.d("Debug", "create success")
                    promise.resolve(null);
                }

                override fun failed(e: Exception) {
                    FLog.d("Debug", "create failed")
                    val failed = "init failed: $e"
                    promise.reject(BSIM_ERRPR, failed)
                }
            })
        } else {
            promise.resolve("");
        }
    }


    @ReactMethod
    fun genNewKey(coinTypeString: String, promise: Promise) {

        var coinType: CoinType = try {
            CoinType.valueOf(coinTypeString)
        } catch (e: IllegalArgumentException) {
            CoinType.CONFLUX
        }

        val result = BSIMSDKInstance?.genNewKey(coinType)

        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve("ok")
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject("400", error["400"])
        }

    }

    @ReactMethod
    fun getPubkeyList(promise: Promise) {
        if (BSIMSDKInstance == null) {
            promise.reject("400", error["400"])
            return
        }
        val pubkeyListResult = BSIMSDKInstance?.getPubkeyList()

        if (pubkeyListResult != null) {
            if (pubkeyListResult.Code === CODE_SUCCESS) {
                var resultList = WritableNativeArray()
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
            promise.reject("400", error["400"]);
        }
    }


    @ReactMethod
    fun signMessage(msg: String, coinTypeIndex: Int, index: Int, promise: Promise) {
        // 校验BPIN
        // !! 签名前必须先校验BPIN，verifyBPIN调用或立刻返回，BSIM卡拉起输入界面，
        // !! 输入结果BSIM卡自动校验，提示用户，APP拿不到校验结果，app不参与BPIN相关流程
        // !! 校验失败后sign时会有提示

        var coinType = CoinType.values().find {it.index === coinTypeIndex}

        if (coinType === null) {
            return promise.reject(BSIM_ERRPR, "coin type not find")
        }

        var keyList = BSIMSDKInstance?.getPubkeyList()

        val message = Message(
            msg = Numeric.hexStringToByteArray(msg),
            coinType = coinType,
            index = index.toUInt()
        )

        val signMsg = BSIMSDKInstance?.signMessage(message)

        if (signMsg != null && keyList != null) {
            var pubkey = keyList.PubkeyList.find { it.index == index }

            if (pubkey != null) {
                if (signMsg.Code == CODE_SUCCESS) {
                    val result = WritableNativeMap()
                    val ecSgn = Utils.Companion.hexRSToECDSASignature(signMsg.R, signMsg.S)
                    val signature = Utils.createSignatureData(
                        ecSgn,
                        Utils.getECKeyFromString(pubkey.key),
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
                        promise.reject(BSIM_ERRPR, "signature data from hex error")
                    }

                } else {
                    promise.reject(signMsg.Code, signMsg.Message)
                }
            }
        }
    }


    @ReactMethod
    fun closeChannel() {
        if (BSIMSDKInstance != null) {
            BSIMSDKInstance?.closeChannel()
        }
    }

    @ReactMethod
    fun getBSIMVersion(promise: Promise) {
        if (BSIMSDKInstance == null) {
            promise.reject("400", error["400"])
            return
        }
        var result = BSIMSDKInstance?.getBSIMVersion();
        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve(result.Message)
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject("400", error["400"])
        }
    }

    @ReactMethod
    fun getVersion(promise: Promise) {
        if (BSIMSDKInstance == null) {
            promise.reject("400", error["400"])
            return
        }

        var result = BSIMSDKInstance?.getVersion()
        if (result != null) {
            promise.resolve(result)
        } else {
            promise.reject(BSIM_ERRPR, "can't get the SDK version")
        }
    }

    @ReactMethod
    fun verifyBPIN(promise: Promise) {
        if (BSIMSDKInstance == null) {
            promise.reject("400", error["400"])
            return
        }
        var result = BSIMSDKInstance?.verifyBPIN();

        if (result != null) {
            if (result.Code == CODE_SUCCESS) {
                promise.resolve(result.Message)
            } else {
                promise.reject(result.Code, result.Message)
            }
        } else {
            promise.reject("BSIM getVersion error", "")
        }

    }

}