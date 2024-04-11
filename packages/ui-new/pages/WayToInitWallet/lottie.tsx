import LottieView from "lottie-react-native";

export default function Animation() {
    return (
      <LottieView
        source={require("./welcome.json")}
        style={{width: "100%", height: "100%"}}
        autoPlay
        loop
        imageAssetsFolder={'lottie/welcome'}
      />
    );
  }