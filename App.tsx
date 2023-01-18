import {StatusBar} from 'expo-status-bar';
import {StyleSheet, View} from 'react-native';
import CanvasComponent from "./src/Canvas";

export default function App() {
    return (
        <View style={styles.container}>
            <CanvasComponent/>
            <StatusBar style="auto"/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
