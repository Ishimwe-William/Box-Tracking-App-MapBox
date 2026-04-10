import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { styles } from "../styles/styles";

interface MyButtonProps {
    title: String,
    handleSubmit: () => void;
    isLoading?: boolean
}

const MyButton: React.FC<MyButtonProps> =({title, handleSubmit, isLoading})=> {
    return (
        <TouchableOpacity
            onPress={!isLoading ? handleSubmit : undefined}
            style={styles.myButton}
            disabled={isLoading}
        >
            <Text style={styles.myButtonText}>{isLoading ? <ActivityIndicator size={24} color={'gray'}/> : title}</Text>
        </TouchableOpacity>
    )
}
export default MyButton;