import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { VictoryChart, VictoryLine, VictoryAxis } from "victory-native";
import { BleManager } from "react-native-ble-plx";
import { atob } from "react-native-quick-base64";
import * as Progress from "react-native-progress";

const bleManager = new BleManager();
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const STEP_DATA_CHAR_UUID = "beefcafe-36e1-4688-b7f5-00000000000b";

export default function App() {
  const [analogValue, setAnalogValue] = useState(0);
  const [averageTime, setAverageTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Searching...");
  const [analogData, setAnalogData] = useState([]);
  const [startTime] = useState(Date.now());

  // Function to update graph data in real-time
  const addDataPoint = (newAnalogValue) => {
    setAnalogData((prevData) => {
      const updatedData = [
        ...prevData,
        { x: (Date.now() - startTime) / 1000, y: newAnalogValue },
      ];
      if (updatedData.length > 20) updatedData.shift();
      return updatedData;
    });
  };

  const connectToDevice = (device) => {
    device
      .connect()
      .then((device) => {
        setConnectionStatus("Connected");
        return device.discoverAllServicesAndCharacteristics();
      })
      .then((device) => device.services())
      .then((services) => {
        let service = services.find((service) => service.uuid === SERVICE_UUID);
        return service.characteristics();
      })
      .then((characteristics) => {
        const stepDataCharacteristic = characteristics.find(
          (char) => char.uuid === STEP_DATA_CHAR_UUID
        );
        stepDataCharacteristic.monitor((error, char) => {
          if (error) {
            console.error(error);
            return;
          }
          const rawData = atob(char.value);
          const dataParts = rawData.split(",");
          let analog = 0,
            avg = 0;

          dataParts.forEach((part) => {
            const [label, value] = part.split(":");
            if (label === "Analog") analog = parseInt(value, 10);
            if (label === "Avg") avg = parseFloat(value);
          });

          setAnalogValue(analog);
          setAverageTime(avg);
          addDataPoint(analog);
        });
      })
      .catch((error) => console.log("Connection error:", error));
  };

  useEffect(() => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) return console.error(error);
      if (device.name === "ESP32_BLE") {
        bleManager.stopDeviceScan();
        setConnectionStatus("Connecting...");
        connectToDevice(device);
      }
    });
  }, []);

  const getIntensityColor = () => {
    if (averageTime >= 700 && averageTime <= 900) return "#4CAF50"; // Green for "Good"
    if (averageTime < 700) return "#FFEB3B"; // Yellow for "Low"
    return "#F44336"; // Red for "High"
  };

  const getIntensityLabel = () => {
    if (averageTime >= 700 && averageTime <= 900) return "Good";
    if (averageTime < 700) return "Low";
    return "High";
  };

  const intensityProgress = (averageTime - 350) / (1600 - 350);

  return (
    <View style={styles.container}>
      <Text style={styles.connectionStatus}>{connectionStatus}</Text>

      <View style={styles.readingsContainer}>
        <Text style={styles.readings}>
          Analog: {analogValue} | Average: {averageTime.toFixed(2)} ms
        </Text>
        <Text style={[styles.intensityLabel, { color: getIntensityColor() }]}>
          Intensity: {getIntensityLabel()}
        </Text>
        <Progress.Bar
          progress={intensityProgress}
          width={200}
          color={getIntensityColor()}
          style={styles.intensityBar}
        />
      </View>

      <VictoryChart>
        <VictoryAxis label="Time (s)" style={{ axisLabel: { padding: 30 } }} />
        <VictoryAxis
          dependentAxis
          label="Analog Value"
          style={{ axisLabel: { padding: 40 } }}
        />
        <VictoryLine
          data={analogData}
          x="x"
          y="y"
          style={{
            data: { stroke: "#c43a31" },
          }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  connectionStatus: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: "bold",
    color: "#333",
  },
  readingsContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  readings: {
    fontSize: 16,
    marginVertical: 5,
    color: "#333",
  },
  intensityLabel: {
    fontSize: 18,
    marginVertical: 5,
  },
  intensityBar: {
    marginTop: 10,
  },
});
