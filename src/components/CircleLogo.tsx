import React from 'react';
import { Image, View } from 'react-native';
import { styles } from '../styles/styles';

interface CircleLogoProp{
    source: undefined,
}

const CircleLogo: React.FC<CircleLogoProp> = ({ source }) => {
    return (
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Image source={source} style={styles.myCircleLogo} />
        </View>
    );
};


export default CircleLogo;