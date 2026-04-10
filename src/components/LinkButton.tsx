import { TouchableOpacity, Text } from "react-native";

interface LinkButtonProps {
    title: String;
    onClick: () => void;
    size:number;
    weight: 'normal' | 'bold' | '300' | '400';
    color?: string;
}

const LinkButton: React.FC<LinkButtonProps> = ({ title, onClick, size, weight, color='#5A9AA9' }) => {
    return (
        <TouchableOpacity style={{ marginVertical: 10, }} onPress={onClick}>
            <Text style={{ textAlign: "center", color: color, fontSize:size, fontWeight: weight }} >{title}</Text>
        </TouchableOpacity>
    )
}

export default LinkButton;