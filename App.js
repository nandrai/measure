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
import image from "./assets/background1.png";

const bleManager = new BleManager();

async function requestLocationPermission() {
  try {
    const granted = PermissionsAndroid.requestMultiple(
      [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ],
      {
        title: "Location permission for Bluetooth scanning",
        message:
          "Grant location permission to allow the app to scan for Bluetooth devices",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("Location permission for Bluetooth scanning granted");
    } else {
      console.log("Location permission for Bluetooth scanning denied");
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
  const [analogValue, setAnalogValue] = useState(0);
  const [averageValue, setAverageValue] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Searching...");

  const deviceRef = useRef(null);

  const searchAndConnectToDevice = () => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setConnectionStatus("Error searching for devices");
        return;
      }
      if (device.name === "ESP32_BLE") {
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
        stepDataCharacteristic.monitor((error, char) => {
          if (error) {
            console.error(error);
            return;
          }
          const rawData = atob(char.value);
          const dataArr = rawData.split(",");
          const analog = parseInt(dataArr[0].split(":")[1]);
          const avg = parseInt(dataArr[1].split(":")[1]);
          setAnalogValue(analog);
          setAverageValue(avg);
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
        <Text style={styles.labelText}>Analog Value: {analogValue}</Text>
        <Text style={styles.labelText}>
          Average Time Between Peaks: {averageValue}
        </Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  labelText: {
    fontSize: 24,
    color: "white",
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
  },
});
