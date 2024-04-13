import {
  StyleSheet,
  Text,
  View,
  ImageBackground,
  PermissionsAndroid,
} from "react-native";
import { BleManager } from "react-native-ble-plx";
import { useState, useEffect, useRef } from "react";
import { atob } from "react-native-quick-base64";
import base64 from "react-native-base64";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import image from "./assets/background1.png";
import * as Device from "expo-device";

const bleManager = new BleManager();

// Android Bluetooth Permission
async function requestLocationPermission() {
  try {
    const granted = PermissionsAndroid.requestMultiple(
      [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ],
      {
        title: "Location permission for bluetooth scanning",
        message:
          "Grant location permission to allow the app to scan for Bluetooth devices",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("Location permission for bluetooth scanning granted");
    } else {
      console.log("Location permission for bluetooth scanning denied");
    }
  } catch (err) {
    console.warn(err);
  }
}

requestLocationPermission();

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const STEP_DATA_CHAR_UUID = "beefcafe-36e1-4688-b7f5-00000000000b";

export default function App() {
  const [deviceID, setDeviceID] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const [stepDataChar, setStepDataChar] = useState(null); // Not Used
  const [connectionStatus, setConnectionStatus] = useState("Searching...");

  const [BPM, setBPM] = useState(0);
  const [HRV, setHRV] = useState(0);
  const [TMP, setTMP] = useState(0);
  const [ECG, setECG] = useState(0);
  const [SpO2, setSpO2] = useState(0);

  const progressBPM = (BPM / 120) * 100;
  const progressHRV = (HRV / 1) * 100;
  const progressTMP = (TMP / 60) * 100;
  const progressSpO2 = (SpO2 / 100) * 100;

  const deviceRef = useRef(null);

  const searchAndConnectToDevice = () => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setConnectionStatus("Error searching for devices");
        return;
      }
      if (device.name === "Step-Sense") {
        bleManager.stopDeviceScan();
        setConnectionStatus("Connecting...");
        connectToDevice(device);
      }
    });
  };

  useEffect(() => {
    searchAndConnectToDevice();
  }, []);

  const connectToDevice = (device) => {
    return device
      .connect()
      .then((device) => {
        setDeviceID(device.id);
        setConnectionStatus("Connected");
        deviceRef.current = device;
        return device.discoverAllServicesAndCharacteristics();
      })
      .then((device) => {
        return device.services();
      })
      .then((services) => {
        let service = services.find((service) => service.uuid === SERVICE_UUID);
        return service.characteristics();
      })
      .then((characteristics) => {
        let stepDataCharacteristic = characteristics.find(
          (char) => char.uuid === STEP_DATA_CHAR_UUID
        );
        setStepDataChar(stepDataCharacteristic);
        stepDataCharacteristic.monitor((error, char) => {
          if (error) {
            console.error(error);
            return;
          }
          const rawStepData = atob(char.value);
          console.log(rawStepData);
          const arr = rawStepData.split(":");
          if (arr[0] === "BPM") {
            setBPM(arr[1]);
          }
          if (arr[0] === "HRV") {
            setHRV(arr[1]);
          }
          if (arr[0] === "TMP") {
            setTMP(arr[1]);
          }
          if (arr[0] === "ECG") {
            setECG(arr[1]);
          }
          if (arr[0] === "SpO2") {
            setSpO2(arr[1]);
          }
          // setStepCount(rawStepData);
        });
      })
      .catch((error) => {
        console.log(error);
        setConnectionStatus("Error in Connection");
      });
  };

  useEffect(() => {
    const subscription = bleManager.onDeviceDisconnected(
      deviceID,
      (error, device) => {
        if (error) {
          console.log("Disconnected with error:", error);
        }
        setConnectionStatus("Disconnected");
        console.log("Disconnected device");
        setStepCount(0); // Reset the step count
        if (deviceRef.current) {
          setConnectionStatus("Reconnecting...");
          connectToDevice(deviceRef.current)
            .then(() => setConnectionStatus("Connected"))
            .catch((error) => {
              console.log("Reconnection failed: ", error);
              setConnectionStatus("Reconnection failed");
            });
        }
      }
    );
    return () => subscription.remove();
  }, [deviceID]);

  return (
    <ImageBackground source={image} style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* <View style={styles.topTitle}>
          <View style={styles.stepTitleWrapper}>
            <Text style={styles.title}>Step Sense</Text>
          </View>
        </View> */}
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <View style={styles.labelBody}>
            <AnimatedCircularProgress
              size={180}
              width={15}
              fill={progressBPM}
              lineCap="round"
              tintColor={
                progressBPM >= 100
                  ? "#FB975C"
                  : progressBPM >= 50
                  ? "#EF664C"
                  : "#FFF386"
              }
              backgroundColor="#3d5875"
            >
              {(fill) => (
                <View style={styles.stepWrapper}>
                  <Text style={styles.steps}>{BPM}</Text>
                  {/* <Text style={styles.percent}>{`${Math.round(fill)}%`}</Text> */}
                </View>
              )}
            </AnimatedCircularProgress>
            <Text style={styles.labelText}>BPM</Text>
          </View>
          <View style={styles.labelBody}>
            <AnimatedCircularProgress
              size={180}
              width={15}
              fill={progressHRV}
              lineCap="round"
              tintColor={
                progressHRV >= 100
                  ? "#FB975C"
                  : progressHRV >= 50
                  ? "#EF664C"
                  : "#FFF386"
              }
              backgroundColor="#3d5875"
            >
              {(fill) => (
                <View style={styles.stepWrapper}>
                  <Text style={styles.steps}>{HRV}</Text>
                  {/* <Text style={styles.percent}>{`${Math.round(fill)}%`}</Text> */}
                </View>
              )}
            </AnimatedCircularProgress>
            <Text style={styles.labelText}>HRV</Text>
          </View>
        </View>
        <View style={{ display: "flex", flexDirection: "row", gap: 12 }}>
          <View style={styles.labelBody}>
            <AnimatedCircularProgress
              size={180}
              width={15}
              fill={progressTMP}
              lineCap="round"
              tintColor={
                progressTMP >= 100
                  ? "#FB975C"
                  : progressTMP >= 50
                  ? "#EF664C"
                  : "#FFF386"
              }
              backgroundColor="#3d5875"
            >
              {(fill) => (
                <View style={styles.stepWrapper}>
                  <Text style={styles.steps}>{TMP}</Text>
                  {/* <Text style={styles.percent}>{`${Math.round(fill)}%`}</Text> */}
                </View>
              )}
            </AnimatedCircularProgress>
            <Text style={styles.labelText}>TMP</Text>
          </View>
          <View style={styles.labelBody}>
            <AnimatedCircularProgress
              size={180}
              width={15}
              fill={progressSpO2}
              lineCap="round"
              tintColor={
                progressSpO2 >= 100
                  ? "#FB975C"
                  : progressSpO2 >= 50
                  ? "#EF664C"
                  : "#FFF386"
              }
              backgroundColor="#3d5875"
            >
              {(fill) => (
                <View style={styles.stepWrapper}>
                  <Text style={styles.steps}>{SpO2}</Text>
                  {/* <Text style={styles.percent}>{`${Math.round(fill)}%`}</Text> */}
                </View>
              )}
            </AnimatedCircularProgress>
            <Text style={styles.labelText}>SpO2</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottomWrapper}>
        <Text style={styles.connectionStatus}>{connectionStatus}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 10,
    width: "100%",
    gap: 12,
  },
  // topTitle: {
  //   paddingVertical: 20,
  //   width: "100%",
  //   justifyContent: "center",
  //   alignItems: "center",
  // },
  // stepTitleWrapper: {
  //   justifyContent: "center",
  //   alignItems: "center",
  //   backgroundColor: "rgba(251, 151, 92, 0.5)",
  //   borderRadius: 15,
  // },
  // title: {
  //   fontSize: 18,
  //   paddingVertical: 10,
  //   paddingHorizontal: 20,
  //   color: "white",
  // },
  stepWrapper: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  steps: {
    fontSize: 48,
    color: "white",
    fontWeight: "bold",
    fontFamily: "Verdana",
  },
  percent: {
    fontSize: 18,
    color: "white",
    marginTop: 10,
  },
  bottomWrapper: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(251, 151, 92, 0.5)",
    marginBottom: 10,
    height: "5%",
    borderRadius: 20,
    width: "90%",
  },
  connectionStatus: {
    fontSize: 20,

    color: "white",
    fontWeight: "bold",
    fontFamily: "System",
  },
  labelBody: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
  },
  labelText: {
    fontSize: 36,
    color: "white",
  },
});
