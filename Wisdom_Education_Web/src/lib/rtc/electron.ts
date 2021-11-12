import { PlatForms, ShareListItem } from "@/config";
import { EnhancedEventEmitter } from "../event";
import logger from "../logger";

// @ts-ignore
const { NERtcSDK, ipcRenderer, eleRemote, platform } = window;
ipcRenderer && ipcRenderer.send("hasRender");
ipcRenderer &&
  ipcRenderer.on("onWindowRender", (event, data) => {
    // @ts-ignore
    window.electronLogPath = data.logPath;
    // @ts-ignore
    logger.debug("electronLogPath", window.electronLogPath);
  });

interface DeviceId {
  label: string;
  deviceId: string;
  isDefault?: boolean;
}
interface RemoteUsers {
  id: number;
}
type NetworkQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type MediaType = "audio" | "video" | "screen";
interface IElecStats {
  uid: number;
  tx_quality: NetworkQuality;
  rx_quality: NetworkQuality;
}
interface RtcDevice {
  device_id: string;
  device_name: string;
  transport_type: number;
  suspected_unavailable: boolean;
  system_default_device: boolean;
}
interface JoinOptions {
  channelName: string | number;
  uid: number;
  token: string;
  audio: boolean;
  video: boolean;
  needPublish?: boolean;
}

type VideoLayers = {
  layer_type: 1 | 2; // 1主2辅
  width: number;
  height: number;
  capture_frame_rate: number;
  render_frame_rate: number;
  encoder_frame_rate: number;
  sent_frame_rate: number;
  sent_bitrate: number;
  target_bitrate: number;
  encoder_bitrate: number;
  codec_name: string;
};
interface LocalStats {
  video_layers_count: number;
  video_layers_list: Array<VideoLayers>;
}

interface RemoteStats {
  uid: number;
  video_layers_count: number;
  video_layers_list: Array<VideoLayers>;
}

interface StatsOpen {
  [key: string]: {
    CaptureResolutionWidth?: number;
    CaptureResolutionHeight?: number;
    RecvResolutionWidth?: number;
    RecvResolutionHeight?: number;
  };
}
type LocalStatsOpen = StatsOpen;

interface RemoteStatsOpen {
  [uid: string]: StatsOpen;
}

interface ScreenRectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NERtcParams {
  record_host_enabled?: boolean;
  record_audio_enabled: boolean;
  record_video_enabled: boolean;
  record_type: 0|1|2;
}

export class NeElertc extends EnhancedEventEmitter {
  private _nertcEngine: any;
  private _appKey: string;
  private _remoteStreams: Map<string, any> = new Map();
  private _remoteUsers: Array<RemoteUsers> = [];
  private _pubConf = {
    audio: true,
    microphoneId: "",
    video: true,
    cameraId: "",
    speakerId: "",
  };
  private localStatsOpen: LocalStatsOpen = {};
  private remoteStatsOpen: RemoteStatsOpen = {};
  private _screen: any;
  private _windowsList: ShareListItem[] = [];
  private _localStream = null;

  constructor(appKey: string) {
    super();
    this._appKey = appKey;
    this._nertcEngine = new NERtcSDK.NERtcEngine();
    // this._nertcEngine.app_key = this._appKey;
    this._nertcEngine.log_dir_path = "";
    const res = this._nertcEngine.initialize({
      app_key: this._appKey,
      log_file_max_size_KBytes: 0, // 设置日志文件的大小上限，单位为 KB。如果设置为 0，则默认为 20 M
      // @ts-ignore
      log_dir_path: window.electronLogPath,
    });
    if (res !== 0) {
      logger.error("initialize fail", this._appKey);
      return;
    } else {
      logger.log("initialize success", this._appKey);
    }
    logger.log("当前g2-ele版本", this._nertcEngine.getVersion());
    this.initEvent();
    // @ts-ignore
    window._nertcEngine = this._nertcEngine;
  }

  get speakerId(): string {
    return this._pubConf.speakerId;
  }

  get microphoneId(): string {
    return this._pubConf.microphoneId;
  }

  get cameraId(): string {
    return this._pubConf.cameraId;
  }

  get client(): any {
    return this._nertcEngine;
  }

  get screen(): any {
    return this._screen;
  }

  get windowsList(): ShareListItem[] {
    return this._windowsList;
  }

  get localStream(): any {
    return this._localStream;
  }

  public initEvent(): void {
    logger.log("addEleRtcListener");
    // 本端加入房间
    this._nertcEngine.on("onJoinChannel", this._onJoinChannel.bind(this));
    // 本端离开房间，释放资源
    this._nertcEngine.on("onLeaveChannel", this._onLeaveChannel.bind(this));
    // 远端用户加入房间
    this._nertcEngine.on("onUserJoined", this._onUserJoined.bind(this));
    // 远端用户离开房间
    this._nertcEngine.on("onUserLeft", this._onUserLeft.bind(this));
    // 远端用户开启音频的事件
    this._nertcEngine.on("onUserAudioStart", this._onUserAudioStart.bind(this));
    // 远端用户停用音频回调
    this._nertcEngine.on("onUserAudioStop", this._onUserAudioStop.bind(this));
    // 远端用户开启视频回调
    this._nertcEngine.on("onUserVideoStart", this._onUserVideoStart.bind(this));
    // 远端用户停用视频回调
    this._nertcEngine.on("onUserVideoStop", this._onUserVideoStop.bind(this));
    // 监听上下行网络质量
    this._nertcEngine.on("onNetworkQuality", this._onNetworkQuality.bind(this));
    // 服务器连接断开
    this._nertcEngine.on("onDisconnect", this._onDisconnect.bind(this));
    // 网络状态改变
    this._nertcEngine.on(
      "onConnectionStateChange",
      this._onConnectionStateChange.bind(this)
    );
    this._nertcEngine.on(
      "onLocalVideoStats",
      this._onLocalVideoStats.bind(this)
    );
    this._nertcEngine.on(
      "onRemoteVideoStats",
      this._onRemoteVideoStats.bind(this)
    );
    this._nertcEngine.on(
      "onUserSubStreamVideoStart",
      this._onUserSubStreamVideoStart.bind(this)
    );
    this._nertcEngine.on(
      "onUserSubStreamVideoStop",
      this._onUserSubStreamVideoStop.bind(this)
    );
    ipcRenderer.on("onWindowCreate", this._onWindowCreate.bind(this));
    ipcRenderer.send("hasJoinClass");
    // 通话统计回调
    // this._nertcEngine.on('onRtcStats', this._onRtcStats.bind(this));
  }

  /**
   * @description: 开启设备
   * @param {MediaType} type
   * @param {string} deviceId
   * @return {*}
   */
  public async open(
    type: MediaType,
    deviceId?: string,
    id?: string
  ): Promise<void> {
    logger.log("electron-open", type, deviceId, id);
    let result;
    switch (type) {
      case "audio":
        result = !deviceId
          ? this._nertcEngine.enableLocalAudio(true)
          : this._nertcEngine.setRecordDevice(deviceId);
        this._pubConf.microphoneId = deviceId || this._pubConf.microphoneId;
        break;
      case "video":
        result = !deviceId
          ? this._nertcEngine.enableLocalVideo(true)
          : this._nertcEngine.setVideoDevice(deviceId);
        this._pubConf.cameraId = deviceId || this._pubConf.cameraId;
        break;
      case "screen":
        // eslint-disable-next-line no-case-declarations
        // const rectRegion = await this.getShareRect();
        // eslint-disable-next-line no-case-declarations
        const rectRegion = {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
        // if (platform === PlatForms.mac) {
        if (deviceId) {
          result = this._nertcEngine.startScreenCaptureByDisplayId(
            Number(deviceId || 0),
            { ...rectRegion },
            {
              prefer: 1,
              profile: 2,
              dimensions: { ...rectRegion }
            }
          );
        } else {
          result = this._nertcEngine.startScreenCaptureByWindowId(
            Number(id || 0),
            { ...rectRegion },
            {
              prefer: 1,
              profile: 2,
              dimensions: { ...rectRegion }
            }
          );
        }
        // } else if (platform === PlatForms.win) {
        //   result = this._nertcEngine.startScreenCaptureByWindowId(
        //     Number(id || 0),
        //     { ...rectRegion },
        //     {
        //       prefer: 1,
        //       profile: 2,
        //       dimensions: { ...rectRegion }
        //     }
        //   );
        // }
        break;
      default:
        break;
    }
    if (result === 0) {
      logger.log("open success", type);
    } else {
      logger.error("open fail", type, result);
      throw "open fail";
    }
  }
  /**
   * @description: 关闭设备
   * @param {MediaType} type
   * @return {*}
   */
  public async close(type: MediaType): Promise<void> {
    logger.log("electron-close", type);
    let result;
    switch (type) {
      case "audio":
        result = this._nertcEngine.enableLocalAudio(false);
        break;
      case "video":
        result = this._nertcEngine.enableLocalVideo(false);
        break;
      case "screen":
        result = this._nertcEngine.stopScreenCapture();
        break;
      default:
        break;
    }
    if (result === 0) {
      logger.log("close success");
    } else {
      logger.error("close fail");
      throw "close fail";
    }
  }

  public async setVideoProfile(): Promise<void> {
    const res = this._nertcEngine.setVideoConfig({
      max_profile: 1,
      width: 320,
      height: 240,
      crop_mode: 0,
      framerate: 15,
      min_framerate: 0,
      bitrate: 0,
      min_bitrate: 0,
      degradation_preference: 1,
    });
    if (res === 0) {
      logger.log("setVideoConfig success");
    } else {
      logger.error("setVideoConfig fail");
      throw "setVideoConfig fail";
    }
  }

  public async setSubStreamRenderMode(
    uid: string | number,
    mode: number
  ): Promise<void> {
    const res = this._nertcEngine.setSubStreamRenderMode(uid, mode);
    if (res === 0) {
      logger.log("setSubStreamRenderMode success");
    } else {
      logger.error("setSubStreamRenderMode fail");
      throw "setSubStreamRenderMode fail";
    }
  }

  public async initLocalStream(): Promise<void> {
    //TODO
  }

  public switchScreenWithCanvas(): void {
    //TODO
  }

  /**
   * @description: 切换扬声器
   * @param {string} deviceId
   * @return {*}
   */
  public async selectSpeakers(deviceId: string): Promise<void> {
    const res = this._nertcEngine.setPlayoutDevice(deviceId);
    if (res === 0) {
      this._pubConf.speakerId = deviceId;
      logger.log("setAudioOutDevice success: ", deviceId);
      return;
    }
    logger.error("setAudioOutDevice fail: ", deviceId);
  }

  /**
   * @description: 切换音频输入设备
   * @param {string} deviceId
   * @return {*}
   */
  public async selectAudio(deviceId: string): Promise<void> {
    logger.log("selectAudio", deviceId);
    this.open("audio", deviceId);
  }

  /**
   * @description: 切换视频设备
   * @param {string} deviceId
   * @return {*}
   */
  public async selectVideo(deviceId: string): Promise<void> {
    logger.log("selectVideo", deviceId);
    this.open("video", deviceId);
  }

  /**
   * @description: 获取麦克风
   * @param {*}
   * @return {*}
   */
  public async getMicrophones(): Promise<DeviceId[]> {
    const mics: RtcDevice[] = this._nertcEngine.enumerateRecordDevices();
    const result = mics.map((item: RtcDevice) => ({
      label: item.device_name,
      deviceId: item.device_id,
      isDefault: item.system_default_device,
    }));
    logger.log("micphones", result);
    return result;
  }

  /**
   * @description: 获取摄像头
   * @param {*}
   * @return {*}
   */
  public async getCameras(): Promise<DeviceId[]> {
    const videos: RtcDevice[] =
      this._nertcEngine.enumerateVideoCaptureDevices();
    const result = videos.map((item: RtcDevice) => ({
      label: item.device_name,
      deviceId: item.device_id,
      isDefault: item.system_default_device,
    }));
    logger.log("cameras", result);
    return result;
  }

  /**
   * @description: 获取扬声器
   * @param {*}
   * @return {*}
   */
  public async getSpeakers(): Promise<DeviceId[]> {
    const speakers: RtcDevice[] = this._nertcEngine.enumeratePlayoutDevices();
    const result = speakers.map((item: RtcDevice) => ({
      label: item.device_name,
      deviceId: item.device_id,
      isDefault: item.system_default_device,
    }));
    logger.log("speakers", result);
    return result;
  }

  public async publish(): Promise<void> {
    //TODO
    this.open("video");
  }

  public async unpublish(): Promise<void> {
    this.close("video");
  }

  /**
   * @description: 加入房间
   * @param {JoinOptions} options
   * @return {*}
   */
  public async join(options: JoinOptions): Promise<void> {
    logger.log("start join");
    try {
      const mics = await this.getMicrophones();
      const speakers = await this.getSpeakers();
      const videos = await this.getCameras();
      if (!mics.length) {
        // throw { msg: '获取到的麦克风列表为空' };
      }
      if (!speakers.length) {
        // throw { msg: '获取到的扬声器列表为空' };
      }
      if (!videos.length) {
        // throw { msg: '获取到的摄像头列表为空' };
      }
      // 初始化设备id
      this._pubConf.microphoneId =
        mics.find((item) => item.isDefault)?.deviceId ||
        this._nertcEngine.getRecordDevice();
      this._pubConf.speakerId =
        speakers.find((item) => item.isDefault)?.deviceId ||
        this._nertcEngine.getPlayoutDevice();
      this._pubConf.cameraId =
        videos.find((item) => item.isDefault)?.deviceId ||
        this._nertcEngine.getVideoDevice() ||
        videos[0]?.deviceId ||
        "";
      // options.audio ? this.open('audio', this._pubConf.microphoneId) : this.close('audio')
      // options.video ? this.open('video', this._pubConf.cameraId) : this.close('video');
      await this.setVideoProfile();
      await this.setParameters();
      const joinRes = this._nertcEngine.joinChannel(
        options.token,
        options.channelName,
        options.uid
      );
      if (joinRes === 0) {
        logger.log("joinChannel success");
      } else {
        logger.error("joinChannel fail");
        throw "joinChannel fail";
      }
    } catch (error) {
      logger.error("join fail: ", error);
      return Promise.reject(error);
    }
  }

  public async getShareList(): Promise<ShareListItem[]> {
    // const screenDisplay = pcUtil
    //   .enumerateDisplay()
    //   .map((item: string, index: number) => ({
    //     title: `屏幕${index + 1}`,
    //     id: parseInt(item, 10),
    //   }));
    // const windowDisplay = pcUtil.enumerateWindows() || [];
    // return [...screenDisplay, ...windowDisplay];
    // if (platform === PlatForms.mac) {
    const sources = await eleRemote.desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true })
    if (sources.length > 0) {
      this._windowsList = sources.map((item) => ({
        id: item.id.split(':')[1],
        displayId: item.display_id,
        name: item.name,
        thumbnail: item.thumbnail.toDataURL(),
        appIcon: item.appIcon?.toDataURL()
      }))
    }
    // } else if (platform === PlatForms.win) {
    //   this._windowsList = [];
    //   const source = await this._nertcEngine.enumerateScreenCaptureSourceInfo(206, 206, 206, 206);
    //   const canvasDom = document.createElement('canvas');
    //   const ctx = canvasDom.getContext('2d')
    //   for (let i = 0; i < source.length; i++) {
    //     const srcinfo = source[i]
    //     if (srcinfo.thumbBGRA !== undefined && srcinfo.thumbBGRA.length !== 0) {
    //       canvasDom.width = srcinfo.thumbBGRA.width
    //       canvasDom.height = srcinfo.thumbBGRA.height
    //       const imgData = new ImageData(new Uint8ClampedArray(srcinfo.thumbBGRA.buffer), srcinfo.thumbBGRA.width, srcinfo.thumbBGRA.height)
    //       ctx?.putImageData(imgData, 0, 0)
    //       srcinfo.captureThumbnail = canvasDom.toDataURL()
    //       ctx?.clearRect(0, 0, canvasDom.width, canvasDom.height)
    //     }
    //     if (srcinfo.iconBGRA !== undefined && srcinfo.iconBGRA.length !== 0) {
    //       canvasDom.width = srcinfo.iconBGRA.width
    //       canvasDom.height = srcinfo.iconBGRA.height
    //       const iconData = new ImageData(new Uint8ClampedArray(srcinfo.iconBGRA.buffer), srcinfo.iconBGRA.width, srcinfo.iconBGRA.height)
    //       ctx?.putImageData(iconData, 0, 0)
    //       srcinfo.captureIcon = canvasDom.toDataURL()
    //       ctx?.clearRect(0, 0, canvasDom.width, canvasDom.height)
    //     }
    //     const sid = srcinfo.displayId || srcinfo.sourceId.toString()
    //     this.windowsList.push({
    //       id: sid,
    //       name: srcinfo.sourceName,
    //       displayId: srcinfo.displayId,
    //       thumbnail: srcinfo.captureThumbnail,
    //       appIcon: srcinfo.captureIcon
    //     })
    //   }
    // }
    logger.log('shareList', this._windowsList);
    return this._windowsList;
  }

  public async getLocalVideoStats() {
    //TODO
  }
  public async getRemoteVideoStats() {
    //TODO
  }

  public async setParameters(options:NERtcParams = {
    record_audio_enabled: false,
    record_video_enabled: false,
    record_type: 0,
  }): Promise<void> {
    const res = await this._nertcEngine.setParameters(options);
  }

  /**
   * @description: 离开频道
   * @param {*}
   * @return {*}
   */
  public async leave(): Promise<void> {
    if (!this._nertcEngine) {
      logger.log("no _nertcEngine");
      return;
    }
    const res = this._nertcEngine.leaveChannel();
    if (res === 0) {
      logger.log("leaveChannel success");
    } else {
      logger.error("leaveChannel fail");
    }
    ipcRenderer.removeAllListeners("onWindowCreate");
  }

  /**
   * @description: 销毁
   * @param {*}
   * @return {*}
   */
  public async destroy(): Promise<void> {
    logger.log("destroy()");
    try {
      this._nertcEngine.release();
      this._nertcEngine = null;
    } catch (error) {
      logger.error("destroy fail: ", error);
    }
  }

  private async getShareRect(): Promise<ScreenRectRegion> {
    return await eleRemote.screen.getAllDisplays()[0].bounds;
  }

  private _onJoinChannel() {
    logger.log("_onJoinChannel", this);
  }

  private _onLeaveChannel() {
    this.destroy();
    logger.log("_onLeaveChannel");
  }

  private async _onUserJoined(uid: number, userName: string) {
    logger.log("_onUserJoined: ", uid, userName);
    this.emit("peer-online", { uid, userName });
  }

  private async _onUserLeft(uid: number, reason: number) {
    logger.log("_onUserLeft: ", uid, reason);
    this.emit("peer-leave", { uid, reason });
  }

  private async _onNetworkQuality(uc: number, stats: IElecStats[]) {
    // logger.log('_onNetworkQuality: ', uc, stats);

    const result = stats.map((item) => ({
      uid: item.uid,
      uplinkNetworkQuality: item.tx_quality,
      downlinkNetworkQuality: item.rx_quality,
    }));
    this.emit("network-quality", result);
  }

  private async _onDisconnect(errorCode: number) {
    logger.log("_onDisconnect: ", errorCode);
    this.emit("onDisconnect", errorCode);
  }

  private async _onConnectionStateChange(state: number, reason: number) {
    logger.log("_onConnectionStateChange: ", state, reason);
    this.emit("connection-state-change", {
      state,
      reason,
    });
  }

  private async _onUserVideoStart(uid: number) {
    const res = this._nertcEngine.subscribeRemoteVideoStream(uid, 0, true);
    if (res === 0) {
      logger.log("subscribeRemoteVideoStream success", uid, true);
    } else {
      logger.error("subscribeRemoteVideoStream fail", uid, true);
    }
  }

  private async _onUserVideoStop(uid: number) {
    const res = this._nertcEngine.subscribeRemoteVideoStream(uid, 0, false);
    if (res === 0) {
      logger.log("subscribeRemoteVideoStream success", uid, true);
    } else {
      logger.error("subscribeRemoteVideoStream fail", uid, true);
    }
  }

  private async _onUserAudioStart(uid: number) {
    //TODO
  }

  private async _onUserAudioStop(uid: number) {
    //TODO
  }

  private async _onLocalVideoStats(data: LocalStats) {
    logger.log("localVideoStats", data);
    const arr = data.video_layers_list || [];
    for (const ele of arr) {
      switch (ele.layer_type) {
        case 1:
          this.localStatsOpen.video = {
            CaptureResolutionWidth: ele.width,
            CaptureResolutionHeight: ele.height,
          };
          break;
        case 2:
          this.localStatsOpen.screen = {
            CaptureResolutionWidth: ele.width,
            CaptureResolutionHeight: ele.height,
          };
          break;
        default:
          break;
      }
    }
  }

  private async _onRemoteVideoStats(data: number, stats: RemoteStats[] = []) {
    for (const item of stats) {
      const arr = item.video_layers_list || [];
      for (const ele of arr) {
        this.remoteStatsOpen[item.uid] = {
          video: {},
          screen: {},
        };
        switch (ele.layer_type) {
          case 1:
            this.remoteStatsOpen[item.uid].video = {
              RecvResolutionWidth: ele.width,
              RecvResolutionHeight: ele.height,
            };
            break;
          case 2:
            this.remoteStatsOpen[item.uid].screen = {
              RecvResolutionWidth: ele.width,
              RecvResolutionHeight: ele.height,
            };
            break;
          default:
            break;
        }
      }
    }
  }

  private async _onUserSubStreamVideoStart(uid: number) {
    logger.log("_onUserSubStreamVideoStart", uid);
    this._nertcEngine.subscribeRemoteVideoSubStream(uid, true);
    this.emit("startScreenSharing", uid);
  }
  private async _onUserSubStreamVideoStop(uid: number) {
    logger.log("_onUserSubStreamVideoStop", uid);
    this._nertcEngine.subscribeRemoteVideoSubStream(uid, false);
    this.emit("stopScreenSharing", uid);
  }

  private async _onWindowCreate(event, data) {
    logger.log("_onWindowCreate", eleRemote, data);
    this._screen = eleRemote?.screen;
    // this._windowsList = data.windowsList;
  }
}
