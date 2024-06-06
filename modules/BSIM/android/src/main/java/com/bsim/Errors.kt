package com.bsim

enum class Errors(val code: String) {
    ErrorUnknown("1000"),
    ErrorNotSupportedCoinType("1001"),
    ErrorGenerateNewKey("1002"),
    ErrorGetPublicKey("1003"),
    ErrorGetBSIMVersion("1004"),
    ErrorVerifyBPIN("1005"),
    ErrorUpdateBPIN("1006"),
    ErrorSignCoinTypeNotFind("1007"),
    ErrorSignMessage("1008"),
    ErrorSignGetPublicKey("1009")
}