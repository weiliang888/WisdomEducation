/*
 * Copyright (c) 2021 NetEase, Inc.  All rights reserved.
 * Use of this source code is governed by a MIT license that can be found in the LICENSE file.
 */

package com.netease.yunxin.app.wisdom.edu.logic.net.service.request

import com.google.gson.JsonArray

/**
 * Created by hzsunyj on 2021/6/2.
 */
data class BatchReq(val operations: JsonArray) {
}