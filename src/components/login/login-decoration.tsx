import { StyleSheet, View } from "react-native";

export function LoginDecoration() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <View style={styles.leftShape} />
      <View style={styles.rightShape} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  leftShape: {
    position: "absolute",
    width: "50%",
    maxWidth: 240,
    aspectRatio: 1.3,
    borderRadius: 999,
    backgroundColor: "#FFE4D2",
    left: "-20%",
    bottom: -50,
    transform: [{ rotate: "-25deg" }],
  },
  rightShape: {
    position: "absolute",
    width: "55%",
    maxWidth: 260,
    aspectRatio: 0.85,
    borderRadius: 999,
    backgroundColor: "#FFF0E5",
    right: "-26%",
    bottom: -90,
    transform: [{ rotate: "30deg" }],
  },
});
