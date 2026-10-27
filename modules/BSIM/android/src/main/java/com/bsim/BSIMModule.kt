package com.bsim

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BSIMModule : Module() {
  private var controller: BSIMController? = null

  override fun definition() = ModuleDefinition {
    Name("BSIM")

    OnCreate {
      val context = appContext.reactContext
        ?: throw IllegalStateException("BSIM requires a React application context")
      controller = BSIMController(context)
    }

    AsyncFunction("openApduChannel") Coroutine { aid: String ->
      withController { it.openApduChannel(aid) }
    }
    AsyncFunction("transmitApdu") Coroutine { payload: String ->
      withController { it.transmitApdu(payload) }
    }
    AsyncFunction("closeApduChannel") Coroutine { ->
      withController { it.closeApduChannel() }
    }

    OnActivityDestroys {
      controller?.releaseChannels()
    }

    OnDestroy {
      controller?.dispose()
      controller = null
    }
  }

  private suspend fun <T> withController(operation: suspend (BSIMController) -> T): T {
    try {
      return operation(requireNotNull(controller))
    } catch (error: BSIMException) {
      throw CodedException(error.code, error.message, error.cause)
    }
  }
}
