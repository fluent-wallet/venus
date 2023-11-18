package com.wallet.bsimsdk

import com.example.bsimlib.Sdk
import com.example.bsimlib.CoinType
import com.example.bsimlib.Message
import com.example.bsimlib.Utils
import com.example.bsimlib.apdu.CODE_SUCCESS

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap

//for bsim

class SDKModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BSIMSDK"
    }


    private var BSIMSDKInstance: Sdk? = null

    private val error =
        mapOf("400" to "BSIMSDK is not create, Please call createMockSDK function first")


    @ReactMethod
    fun create(appId: String) {

        if (BSIMSDKInstance == null) {
            BSIMSDKInstance = Sdk(reactContext.applicationContext);
        }

    }


    @ReactMethod
    fun genNewKey(coinTypeString: String, promise: Promise) {

        var coinType = CoinType.CONFLUX

        try {
            coinType = CoinType.valueOf(coinTypeString)
        } catch (e: IllegalArgumentException) {
            // do nothing
        }
        val result = BSIMSDKInstance?.genNewKey(coinType)


        if (result != null) {

            if (result.Code == CODE_SUCCESS) {
                promise.resolve("ok")
            } else {
                promise.reject("BSIM error", result.Message)
            }
        } else {
            promise.reject("400", error["400"])
        }

    }


    @ReactMethod
    fun signMessage(msg: String, coinTypeString: String, index: Double, promise: Promise) {

        var coinType = CoinType.CONFLUX

        try {
            coinType = CoinType.valueOf(coinTypeString)
        } catch (e: IllegalArgumentException) {
            // do nothing
        }

        val message = Message(msg = msg.toByteArray(), coinType = coinType, index = index.toUInt())

        val singMsg = BSIMSDKInstance?.signMessage(message)

        if (singMsg != null) {
            if (singMsg.Code == CODE_SUCCESS) {
                val result = WritableNativeMap()
                result.putString("code", singMsg.Code)
                result.putString("message", singMsg.Message)
                result.putString("r", singMsg.R)
                result.putString("s", singMsg.S)

            } else {
                val result = WritableNativeMap()
                promise.reject("BSIM signMessage error", singMsg.Message)

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
                promise.reject("BSIM getPubkeyList error", pubkeyListResult.Message)
            }
        } else {
            promise.reject("400", error["400"]);Ï
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
                promise.reject("BSIM getBSIMVersion error", result.Message)
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
            promise.reject("BSIM getVersion error", "")
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
                promise.reject("BSIM verifyBPIN error", result.Message)
            }
        } else {
            promise.reject("BSIM getVersion error", "")
        }

    }

}