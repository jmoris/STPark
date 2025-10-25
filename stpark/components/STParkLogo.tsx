import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface STParkLogoProps {
  size?: number;
  color?: string;
  showText?: boolean;
}

export const STParkLogo: React.FC<STParkLogoProps> = ({ 
  size = 60, 
  color = '#ffffff',
  showText = true 
}) => {
  const logoSize = size;
  const textSize = size * 0.4;
  const orangeSize = size * 0.15;
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    letterP: {
      fontSize: logoSize,
      fontWeight: 'bold',
      color: color,
      fontFamily: 'Arial',
    },
    orangeSquare: {
      position: 'absolute',
      bottom: logoSize * 0.1,
      left: logoSize * 0.15,
      width: orangeSize,
      height: orangeSize,
      backgroundColor: '#FF6B35',
      borderRadius: 2,
      shadowColor: '#FF6B35',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 8,
    },
    textContainer: {
      marginLeft: size * 0.1,
    },
    stparkText: {
      fontSize: textSize,
      fontWeight: 'bold',
      color: color,
      fontFamily: 'Arial',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.letterP}>P</Text>
        <View style={styles.orangeSquare} />
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={styles.stparkText}>STPark</Text>
        </View>
      )}
    </View>
  );
};
