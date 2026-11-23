import React from 'react';
import { Composition } from 'remotion';
import { TriDucVideo, videoDuration } from './Video.jsx';
import { FPS } from './timeline.js';
import mau from '../kich-ban/_mau.json';

const defaultProps = { kichBan: mau, durations: null, nhac: null, amThanh: false, kieu: '3d' };
const calc = ({ props }) => ({ durationInFrames: videoDuration(props.kichBan, props.durations), props });

export const Root = () => (
  <>
    <Composition id="Ngang" component={TriDucVideo} width={1920} height={1080} fps={FPS}
      durationInFrames={300} defaultProps={defaultProps} calculateMetadata={calc} />
    <Composition id="Doc" component={TriDucVideo} width={1080} height={1920} fps={FPS}
      durationInFrames={300} defaultProps={defaultProps} calculateMetadata={calc} />
  </>
);
