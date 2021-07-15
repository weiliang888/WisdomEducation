/*
 * @Author: lizhaoxuan
 * @Date: 2021-05-12 10:15:03
 * @LastEditTime: 2021-06-07 21:44:26
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /app_wisdom_education_web/src/store/index.js
 */


import { observable, autorun, action, toJS, computed, makeObservable } from 'mobx';
import { GlobalStorage } from '@/utils';
import { RoomStore } from './room';
import { WhiteBoardStore } from './whiteboard';
import { UIStore } from '@/store/ui';
import { RecordStore } from './record';



export class AppStore {
  @observable
  private _roomInfo: Record<string, string> = {}

  @computed
  get roomInfo(): Record<string, string> {
    return this._roomInfo;
  }

  roomStore: RoomStore;
  whiteBoardStore: WhiteBoardStore;
  uiStore:UIStore;
  recordStore: RecordStore;

  constructor() {
    makeObservable(this);
    this.load();
    // roomInfo改变会更新stroage
    autorun(() => {
      const data = toJS(this)
      GlobalStorage.save("room", {
        roomInfo: data._roomInfo,
      })
    });

    this.roomStore = new RoomStore(this);
    this.whiteBoardStore = new WhiteBoardStore(this);
    this.uiStore = new UIStore(this);
    this.recordStore = new RecordStore(this);
  }

  /**
   * @description: 每次加载会获取一遍roomInfo
   * @param {*}
   * @return {*}
   */
  private load(): void {
    const storage = GlobalStorage.read("room")
    if (storage) {
      this._roomInfo = storage.roomInfo
    }
  }

  /**
   * @description: 重置roomInfo
   * @param {*}
   * @return {*}
   */
  @action
  resetRoomInfo(): void {
    this._roomInfo = {}
  }
  /**
   * @description: 设置roomInfo
   * @param {*}
   * @return {*}
   */
  @action
  setRoomInfo(payload: any): void {
    this._roomInfo = {
      roomName: payload.roomName,
      roomUuid: payload.roomUuid,
      sceneType: payload.sceneType,
      role: payload.role,
      userName: payload.userName,
      userUuid: payload.userUuid,
    }
  }
}