package com.bsim

internal class BSIMException(
    val code: String,
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
