import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { styles } from "../styles/styles";
import Ionicons from '@expo/vector-icons/Ionicons';

interface MyButtonProps {
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    handleSubmit: () => void;
    isLoading: boolean;
    size: number;
    color: string
}

const MySmallButton: React.FC<MyButtonProps> = ({ iconName, handleSubmit, size, color, isLoading }) => {
    return (
        <TouchableOpacity
            onPress={!isLoading ? handleSubmit : undefined}
            style={styles.mySmallButton}
            disabled={isLoading}
        >
            <Ionicons name={iconName} size={size} color={color}/>
        </TouchableOpacity>
    )
}
export default MySmallButton;