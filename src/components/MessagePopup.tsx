import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles/styles";

interface MessagePopupProps {
    text: String;
    type: 'success' | 'error';
    visible: boolean;
}

const MessagePopup: React.FC<MessagePopupProps> = ({ text, type, visible }) => {
    if (!visible) return null;
    return (
        <View style={[styles.myMessagePopup, { backgroundColor: type === 'success' ? 'green' : 'red' }]}>
            <Text style={{ color: 'white', textAlign: "center" }}>{text}</Text>
        </View>
    )
}

export default MessagePopup;