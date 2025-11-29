import React from 'react';
import Svg, { Defs, Style, Mask, LinearGradient, Stop, Rect, G, Metadata, Polygon, Path } from 'react-native-svg';

interface StreamScribeIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export const StreamScribeIcon: React.FC<StreamScribeIconProps> = ({ 
  width = 32, 
  height = 32,
  color 
}) => {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 4018.37 4018.37"
      style={{
        shapeRendering: 'geometricPrecision',
        textRendering: 'geometricPrecision',
        imageRendering: 'optimizeQuality',
        fillRule: 'evenodd',
        clipRule: 'evenodd'
      }}
    >
      <Defs>
        <Mask id="id0">
          <LinearGradient
            id="id1"
            gradientUnits="userSpaceOnUse"
            x1="2637.49"
            y1="1090.9"
            x2="-276.18"
            y2="4280.74"
          >
            <Stop offset="0" stopOpacity="1" stopColor="white" />
            <Stop offset="1" stopOpacity="0" stopColor="white" />
          </LinearGradient>
          <Rect
            fill="url(#id1)"
            x="-4.8"
            y="-4.8"
            width="4027.96"
            height="4027.96"
          />
        </Mask>
      </Defs>
      
      <G id="Camada_x0020_1">
        <G id="_105553246692832">
          <G>
            <Rect fill="#FF6600" width="4018.37" height="4018.37" />
            <Polygon
              fill="#C4460C"
              mask="url(#id0)"
              points="-0,4018.37 4018.37,4018.37 4018.37,0 -0,0"
            />
          </G>
          <G>
            <Path
              fill="white"
              d="M442.77 1754.85l1386.12 0 310.6 -452.75 -1386.12 0 -310.6 452.75zm1734.49 -452.75l-310.6 452.75 1386.12 0 310.6 -452.75 -1386.12 0z"
            />
            <Path
              fill="white"
              d="M1831.09 1782.84l-1384.88 0 321.94 452.64 1384.88 0 -321.94 -452.64zm37.68 0l321.94 452.64 1384.88 0 -321.94 -452.64 -1384.88 0z"
            />
            <Path
              fill="white"
              d="M1840.77 2715.61l309.9 -452.09 -1383.84 0 -309.86 452.09 1383.84 0 -0.05 0zm1732.48 -452.09l-1384.88 0 -310.34 452.74 1384.88 0 310.34 -452.74z"
            />
          </G>
        </G>
      </G>
    </Svg>
  );
};