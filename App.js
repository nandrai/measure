import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { VictoryChart, VictoryLine, VictoryAxis } from "victory-native";
import { BleManager } from "react-native-ble-plx";
import { atob } from "react-native-quick-base64";

const bleManager = new BleManager();
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const STEP_DATA_CHAR_UUID = "beefcafe-36e1-4688-b7f5-00000000000b";

export default function App() {
  const [analogValue, setAnalogValue] = useState(0);
  const [averageTime, setAverageTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Searching...");
  const [analogData, setAnalogData] = useState([]);
  const [startTime] = useState(Date.now()); // Record the start time

  // Function to update graph data in real-time
  const addDataPoint = (newAnalogValue) => {
    setAnalogData((prevData) => {
      const updatedData = [
        ...prevData,
        { x: (Date.now() - startTime) / 1000, y: newAnalogValue }, // Calculate seconds since start
      ];
      if (updatedData.length > 20) updatedData.shift(); // Limit data points
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

  return (
    <View style={styles.container}>
      <Text style={styles.connectionStatus}>{connectionStatus}</Text>
      <Text style={styles.readings}>
        Analog: {analogValue} | Average: {averageTime.toFixed(2)} ms
      </Text>

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
  },
  connectionStatus: {
    fontSize: 18,
    marginBottom: 10,
  },
  readings: {
    fontSize: 16,
    marginVertical: 10,
  },
});
