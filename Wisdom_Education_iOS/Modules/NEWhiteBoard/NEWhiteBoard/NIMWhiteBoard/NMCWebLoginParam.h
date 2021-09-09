//
//  NMCWebLoginParam.h
//  BlockFo
//
//  Created by taojinliang on 2019/5/30.
//  Copyright © 2019 BlockFo. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN


@interface NMCWebLoginParam : NSObject

/// 昵称
@property (nonatomic, strong) NSString *nickname;


/**
 开启 web 调试日志
 */
@property(nonatomic, assign) BOOL debug;


@property(nonatomic, strong) NSNumber *uid;

/**
 IM 账号体系 密码
 */
@property(nonatomic, strong) NSString *pwd;

/**
 白板房间名称 为 唯一值
 */
@property(nonatomic, strong) NSString *channelName;

/**
 IM 账号体系 appKey
 */
@property(nonatomic, strong) NSString *appKey;

/**
 客户端WebView的高
 */
@property(nonatomic, assign) NSInteger height;

/**
 客户端WebView的宽
 */
@property(nonatomic, assign) NSInteger width;

/**
 是否服务端录制
 */
@property(nonatomic, assign) BOOL record;

@end


NS_ASSUME_NONNULL_END
