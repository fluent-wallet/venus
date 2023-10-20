package com.wallet.bsimsdk

import com.example.bsimlib.MockSdk
import com.example.bsimlib.CoinType
import com.example.bsimlib.Message

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

import android.util.Log
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap


class MockSDKModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BSIMSDK"
    }


    private var BSIMSDKInstance: MockSdk? = null

    private val error =
        mapOf("400" to "BSIMSDK is not create, Please call createMockSDK function first")

    @ReactMethod
    fun create(appId: String) {

        if (BSIMSDKInstance == null) {
            BSIMSDKInstance = MockSdk(appId, reactContext.applicationContext);
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

        val newKey = BSIMSDKInstance?.genNewKey(coinType)

        if (newKey != null) {

            val result = WritableNativeMap()
            result.putString("coinType", newKey.coinType.name)
            result.putString("key", newKey.key)
            result.putInt("index", newKey.index)
            promise.resolve(result)

        } else {
            Log.v("wallet", "nothing")
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
            promise.resolve(singMsg)
        } else {
            promise.reject("400", error["400"])
        }
    }

    @ReactMethod
    fun batchSignMessage(messages: ReadableArray, promise: Promise) {

        var result = WritableNativeArray()
        if (messages.size() == 0) {
            promise.resolve(result)
        }

        val messageList = mutableListOf<Message>()

        for (i in 0..<messages.size()) {
            val msgReadableMap = messages.getMap(i)

            val coinTypeStr = msgReadableMap.getString("coinType")
            val msg = msgReadableMap.getString("msg")
            val index = msgReadableMap.getInt("index")

            var coinType = CoinType.CONFLUX

            if (coinTypeStr != null) {
                try {
                    coinType = CoinType.valueOf(coinTypeStr)
                } catch (e: IllegalArgumentException) {
                    // do nothing
                }
            }

            if (msg == null) {
                promise.reject("400", "message cannot be empty")
                return
            }

            messageList.add(
                Message(
                    msg = msg.toByteArray(),
                    coinType = coinType,
                    index = index.toUInt()
                )
            )

        }

        val singMessages = BSIMSDKInstance?.batchSignMessage(messageList.toTypedArray())

        var resultArray = WritableNativeArray()


        if (singMessages != null) {
            for (m in singMessages) {
                resultArray.pushString(m)
            }
            promise.resolve(resultArray)
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
        val pubKeyList = BSIMSDKInstance?.getPubkeyList()

        if (pubKeyList != null) {
            var resultList = WritableNativeArray()
            for (key in pubKeyList) {

                val temp = WritableNativeMap()
                temp.putString("coinType", key.coinType.name)
                temp.putString("key", key.key)
                temp.putInt("index", key.index)
                resultList.pushMap(temp)
            }
            promise.resolve(resultList)
        } else {
            promise.resolve(WritableNativeArray())
        }
    }

}