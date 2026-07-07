//@name:TG搜
//@version:29
//@webSite:https://t.me/s/
//@env:TG搜频道列表##格式 频道名称1@频道id1|频道名称2@频道id2
//@remark:
//@order: A17

// ignore
// 不支持导入，这里只是本地开发用于代码提示
// 如需添加通用依赖，请联系 https://t.me/uzVideoAppbot
import {
    FilterLabel,
    FilterTitle,
    VideoClass,
    VideoSubclass,
    VideoDetail,
    RepVideoClassList,
    RepVideoSubclassList,
    RepVideoList,
    RepVideoDetail,
    RepVideoPlayUrl,
    UZArgs,
    UZSubclassVideoListArgs,
} from '../../core/core/uzVideo.js'

import {
    UZUtils,
    ProData,
    ReqResponseType,
    ReqAddressType,
    req,
    getEnv,
    setEnv,
    goToVerify,
    openWebToBindEnv,
    toast,
    kIsDesktop,
    kIsAndroid,
    kIsIOS,
    kIsWindows,
    kIsMacOS,
    kIsTV,
    kLocale,
    kAppVersion,
    formatBackData,
} from '../../core/core/uzUtils.js'

import { cheerio, Crypto, Encrypt, JSONbig } from '../../core/core/uz3lib.js'
// ignore

//MARK: 注意
// 直接复制该文件进行扩展开发
// 请保持以下 变量 及 函数 名称不变
// 请勿删减，可以新增

// 默认频道列表
const DEFAULT_CHANNELS = [
    { name: '豆儿盘', id: 'douerpan' },
    { name: '偶豆豆', id: 'odoudouo' },
    { name: '豆儿123', id: 'zyfb123' },
    { name: 'LEO资源', id: 'leoziyuan' },
    { name: '资源宇宙', id: 'tgsearchers6' }
]

const appConfig = {
    _webSite: 'https://t.me/s/',
    /**
     * 网站主页，uz 调用每个函数前都会进行赋值操作
     * 如果不想被改变 请自定义一个变量
     */
    get webSite() {
        return this._webSite
    },
    set webSite(value) {
        this._webSite = value
    },

    _channels: [...DEFAULT_CHANNELS], // 频道列表
    _channelsInitialized: false, // 标记是否已初始化频道列表

    _uzTag: '',
    /**
     * 扩展标识，初次加载时，uz 会自动赋值，请勿修改
     * 用于读取环境变量
     */
    get uzTag() {
        return this._uzTag
    },
    set uzTag(value) {
        this._uzTag = value
    },
}

// --- 全局常量/配置 ---
// 统一的网盘配置 - 单一数据源
const CLOUD_PROVIDERS = {
    tianyi: {
        name: '天翼',
        domains: ['189.cn']
    },
    quark: {
        name: '夸克',
        domains: ['pan.quark.cn']
    },
    uc: {
        name: 'UC',
        domains: ['drive.uc.cn']
    },
    baidu: {
        name: '百度',
        domains: ['pan.baidu.com', 'yun.baidu.com']
    },
    pan123: {
        name: '123',
        domains: ['123684.com', '123865.com', '123912.com', '123pan.com', '123pan.cn']
    },
    yidong: {
        name: '移动',
        domains: ['caiyun.139.com', 'yun.139.com']
    },
    '115': {
        name: '115',
        domains: ['115cdn.com', '115.com', 'anxia.com']
    },
    ali: {
        name: '阿里',
        domains: ['aliyundrive.com', 'alipan.com']
    },
    pikpak: {
        name: 'PikPak',
        domains: ['pikpak.me']
    },
    xunlei: {
        name: '迅雷',
        domains: ['pan.xunlei.com']
    },
    guangya: {
        name: '光鸭',
        domains: ['guangyapan.com']
    }
};

// 从统一配置自动生成所需数组
const panUrlsExt = Object.values(CLOUD_PROVIDERS).flatMap(provider => provider.domains);

// 预编译网盘提供商正则表达式，提高匹配性能
const providerRegexMap = Object.values(CLOUD_PROVIDERS).map(provider => ({
    name: provider.name,
    // 将多个域名组合成一个正则，用 | 分隔，转义点号
    regex: new RegExp(provider.domains.map(domain =>
        domain.replace(/\./g, '\\.')
    ).join('|'), 'i')
}));

// 预编译剧集信息提取正则表达式，一次匹配解决所有情况
// 支持: "更新至 第28集", "第28集", "全28集", "共28集", "28集全", "更新至28集", "更至EP01", "EP167集", "更新 EP167集", "更新4集", "S01 E27", "S01 E27已更新" 等格式
const EPISODE_COMBINED_REGEX = /((?:更新至|全|第|共)\s*(?:第)?\s*\d+\s*集)|((?:更新至|全|第|共)\s*(?:第)?\s*[一二三四五六七八九十百千万亿]+\s*集)|(\d+\s*集\s*全)|([一二三四五六七八九十百千万亿]+\s*集\s*全)|((?:更至|更)\s*(?:EP)?\s*\d+)|((?:更新\s*)?EP\d+集)|(更新\d+集)|(S\d+\s*E\d+(?:已更新)?)/;

// 预编译图片URL提取正则表达式
const IMAGE_URL_REGEX = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/;
// --- 全局常量结束 ---

/**
 * 初始化频道列表（仅在首次调用时执行）
 */
async function initChannels() {
    if (!appConfig._channelsInitialized) {
        try {
            const channelsConfig = await getEnv(appConfig.uzTag, "TG搜频道列表")

            if (channelsConfig && channelsConfig.length > 0) {
                // 从环境变量获取频道列表
                const userChannels = channelsConfig
                    .split('|')
                    .map((item) => {
                        const arr = item.split('@')
                        if (arr.length === 2 && arr[0].trim() && arr[1].trim()) {
                            return {
                                name: arr[0].trim(),
                                id: arr[1].trim(),
                            }
                        }
                        return null
                    })
                    .filter(Boolean)

                if (userChannels.length > 0) {
                    appConfig._channels = userChannels
                }
            } else {
                // 如果没有环境变量配置，设置默认的频道列表到环境变量
                const defaultChannelsStr = DEFAULT_CHANNELS
                    .map(channel => `${channel.name}@${channel.id}`)
                    .join('|')

                await setEnv(appConfig.uzTag, "TG搜频道列表", defaultChannelsStr)
            }

            appConfig._channelsInitialized = true
        } catch (error) {
            console.error('初始化频道列表失败:', error)
            // 即使失败也标记为已初始化，避免重复尝试
            appConfig._channelsInitialized = true
        }
    }
}

/**
 * 异步获取分类列表的方法。
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoClassList())>}
 */
async function getClassList(args) {
    var backData = new RepVideoClassList()
    try {
        // 初始化频道列表（仅首次执行）
        await initChannels()

        appConfig._channels.forEach((channel) => {
            backData.data.push({
                type_id: channel.id,
                type_name: channel.name,
            })
        })
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取二级分类列表筛选列表的方法。
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoSubclassList())>}
 */
async function getSubclassList(args) {
    var backData = new RepVideoSubclassList()
    try {
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}


const _videoListPageMap = {}
/**
 * 获取分类视频列表
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function getVideoList(args) {
    var backData = new RepVideoList()
    try {
        // 初始化频道列表（仅首次执行）
        await initChannels()

        let endUrl = appConfig.webSite + args.url
        if(args.page == 1) {
            _videoListPageMap[args.url] = ""
        }else {
            const nextPage = _videoListPageMap[args.url] ?? ""
            if(nextPage.length == 0 || nextPage == "0") {
                return JSON.stringify(backData)
            }
            endUrl += nextPage
        }
        const res = await getTGList(endUrl, false)
        // 返回前对结果进行去重
        backData.data = deduplicateVideoListByLinks(res.videoList);
        _videoListPageMap[args.url] = res.nextPage
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}


async function getTGList(url, isSearchContext = false){
    let videoList = []
    let nextPage = ""

    // --- 提取频道ID和名称 ---
    let currentChannelId = null;
    const urlMatch = url.match(/\/s\/([^/?]+)/);
    if (urlMatch && urlMatch[1]) {
        currentChannelId = urlMatch[1];
    }

    const channelMap = new Map();
    appConfig._channels.forEach(channel => {
        channelMap.set(channel.id, channel.name); // 键: id, 值: name
    });

    const currentChannelName = currentChannelId ? (channelMap.get(currentChannelId) || '未知频道') : '未知频道';
    // --- 提取结束 ---

    try {
        const res = await req(url)
        const $ = cheerio.load(res.data)
          nextPage = $('link[rel="prev"]').attr('href')?.split('?')?.[1]

        const messageList = $('.tgme_widget_message_bubble')
        for (let i = 0; i < messageList.length; i++) {
            const message = messageList[i]
	            const messageContainer = $(message).closest('.tgme_widget_message')
            const aList = messageContainer.find('a')
            const video = new VideoDetail()

            // --- 提取消息ID ---
            const postIdStr = messageContainer.attr('data-post')?.split('/')?.[1];
            video.message_id = parseInt(postIdStr || '0') || 0; // 存储消息ID
            // --- 提取消息ID结束 ---

            for (let j = 0; j < aList.length; j++) {
                const a = aList[j]
                const style = $(a).attr('style')

                if (style && style.includes('image')) {
                    const match = style.match(IMAGE_URL_REGEX)
                    if (match) {
                        const imageUrl = match[1]
                        video.vod_pic = imageUrl
                        break
                    }
                }
            }
            const time = $(message).find('time').attr('datetime')

            // 安全的时间格式化处理，防止无效日期导致的错误
            let formattedDate = '未知时间';
            if (time) {
                const date = new Date(time);
                if (!isNaN(date.getTime())) {
                    formattedDate = date
                        .toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                        })
                        .replace(/\//g, '-');
                }
            }

            const htmlContent = $(message).find('div.tgme_widget_message_text').html()
            const remarkLine = htmlContent?.match(/<b>\s*备注[：:]\s*<\/b>\s*([^<]+)/i)?.[1]?.replace(/&nbsp;/g, ' ').trim() || ''
            const episodeLine = htmlContent?.match(/<b>\s*集数[：:]\s*<\/b>\s*([^<]+)/i)?.[1]?.replace(/&nbsp;/g, ' ').trim() || ''

            // 取到第一个 <br> 之前的内容
            let cleanedTitle = '';
            if (htmlContent) {
                cleanedTitle = htmlContent
                    .split('<br>')[0]
                    .replace(/<[^>]+>/g, "")
                    .replace(/&nbsp;/g, ' ')  // 处理 HTML 实体 &nbsp;
                    .trim()
                    .replace(/^(名称[：:])/, '')
                    .trim();
            }
	                // 标题清理 v2：
	                // 1) 去掉开头连续的 emoji/标点/空白，但保留各种左括号（避免残留“】”）
	                cleanedTitle = cleanedTitle
	                    .replace(/^[^\u4e00-\u9fa5A-Za-z0-9\(\[\{（【《「『〔〖〈﹝［]+/, '')
	                    .trim();

	                // 1.5) 去掉开头的分类标签，如"电视剧 "、"动漫 "、"电影 "、"综艺｜"等
	                cleanedTitle = cleanedTitle
	                    .replace(/^(电视剧|动漫|电影|综艺|纪录片|动画)[\s|｜]+/, '')
	                    .trim();

	                // --- 关键修改：在去掉括号之前，先从完整标题中提取剧集信息 ---
	                // 使用合并的正则表达式，一次匹配解决所有情况
	                const episodeMatch = cleanedTitle.match(EPISODE_COMBINED_REGEX);
	                const extractedEpisodeInfoRaw = episodeLine || (episodeMatch ? episodeMatch[0] : null);
	                const extractedEpisodeInfo = extractedEpisodeInfoRaw ? extractedEpisodeInfoRaw.replace(/\s+/g, '') : null;

	                // 如果找到剧集信息，去掉其前面的逗号
	                if (extractedEpisodeInfoRaw) {
	                    const escapedEpisodeInfo = extractedEpisodeInfoRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	                    cleanedTitle = cleanedTitle.replace(new RegExp(`，\\s*${escapedEpisodeInfo}`), extractedEpisodeInfoRaw);
	                }
	                // --- 提取结束 ---

	                // 2) 根据标题开头是否为括号，选择不同的清理策略
	                const startsWithBracket = /^[\(\[\{（【《「『〔〖〈﹝［]/.test(cleanedTitle);
	                if (startsWithBracket) {
	                    // 标题开头是括号：
	                    // 第一步：去掉开头的括号及其内容
	                    cleanedTitle = cleanedTitle
	                        .replace(/^[\(\[\{（【《「『〔〖〈﹝［][^\)\]\}）】》」』〕〗〉﹞］]*[\)\]\}）】》」』〕〗〉﹞］]/, '')
	                        .trim();
	                    // 第二步：去掉之后碰到的第一个括号及其后的所有内容
	                    cleanedTitle = cleanedTitle
	                        .replace(/[\(\[\{（【《「『〔〖〈﹝［].*$/, '')
	                        .trim();
	                } else {
	                    // 标题开头不是括号：去掉第一个括号及其后的所有内容
	                    cleanedTitle = cleanedTitle
	                        .replace(/[\(\[\{（【《「『〔〖〈﹝［].*$/, '')
	                        .trim();
	                }

            // 首先分配初始清理后的标题
            video.vod_name = cleanedTitle;
            const ids = _getAllPanUrls(messageContainer.html() || "")
            video.vod_id = JSON.stringify(ids)

            // --- 新的备注逻辑：从URL确定提供商 ---
            let providers = new Set();

            if (ids && ids.length > 0) {
                for (const url of ids) {
                    for (const provider of providerRegexMap) {
                        if (provider.regex.test(url)) {
                            providers.add(provider.name);
                            break;
                        }
                    }
                }
            }

            // 注意：剧集信息提取已在第354-361行的括号清理之前进行
            // 这样可以确保即使剧集信息在括号后面也能被正确提取

            // --- 如果提取了剧集信息，调整vod_name ---
            if (extractedEpisodeInfoRaw) {
                video.vod_name = cleanedTitle.replace(extractedEpisodeInfoRaw, '').replace(/\s+/g, ' ').trim();
            }
            // --- 调整结束 ---

            // --- 清理画质/码率相关信息 ---
            // 移除常见的画质、码率、帧率等信息
            // 注意：先匹配完整词组（如"杜比视界"），再匹配单个词（如"杜比"），避免部分匹配导致残留
            video.vod_name = video.vod_name
                .replace(/\s*\d+\s*\+\s*\d+\s*帧\s*/g, '')  // 清理复合帧率，如 "25+60帧"
                .replace(/\s*4[Kk]\s*(DV|HDR10|SDR10|臻彩|杜比)?\s*(高码率|50帧|10bit)?\s*/g, '')
                .replace(/\s*\d+[pP]\s*/g, '')  // 清理分辨率+p，如 "1080p"、"720P"
                .replace(/\s*(杜比视界|杜比音效|WEB-60fpsMAX|WEB-|DV|HDR10|HDR|SDR|臻彩|杜比|高码率|中码率|50帧|25帧|60帧|10bit|10BIT|纯净版|完结|全景声|超高码率|EDR|标码|Vivid|三维菁彩声|txb|源码|剧版|无台标|ATVP|IQ|Friday|多国字幕|双语|简中|日语|无损|特别版|软字幕|补链接|MAX|中码|音效|高码|台配|国语|环绕声|蓝光原盘|臻享超高清|首播|点映|Viu|10B|硬字幕|环绕立体声)\s*/g, '')
                .replace(/\s*内封[^\s]*\s*/g, '')  // 清理"内封"及其后续内容，如 "内封多国字幕"、"内封简中日"
                .replace(/\s*——\s*/g, ' ')  // 清理"——"
                .replace(/\s*\d{4}年?\s*/g, '')  // 清理年份信息，如 "2025" 或 "2025年"
                .replace(/\s*大小\s*\d+\.?\d*\s*[KMGT]B\s*/g, '')  // 清理文件大小，如 "大小9.32GB"
                .replace(/\d+\.?\d*\s*[KMGT]B/g, '')  // 清理文件大小（无"大小"前缀，可能无空格），如 "9.32GB" 或 "2.96G"
                .replace(/\s*已?更新\s*/g, '')  // 清理"更新"或"已更新"
                .replace(/\s*\+\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            // --- 清理结束 ---

            // --- 网盘类型放在 topRightRemarks ---
            if (providers.size > 0) {
                video.topRightRemarks = Array.from(providers).join('/');
            }
            // --- topRightRemarks 结束 ---

            // --- 根据可用信息动态构建备注 ---
            const remarkParts = [];
            // 只有在搜索上下文中且不是默认的'未知频道'时才添加频道名称
            if (isSearchContext && currentChannelName !== '未知频道') {
                remarkParts.push(currentChannelName);
            }
            if (remarkLine) {
                remarkParts.push(remarkLine.replace(/\s+/g, ' ').trim());
            } else if (extractedEpisodeInfo) {
                remarkParts.push(extractedEpisodeInfo);
            }

            if (remarkParts.length > 0) {
                video.vod_remarks = remarkParts.join('|');
            } else {
                // 如果没有其他信息可用，则保持为空
                video.vod_remarks = '';
            }
            // --- 构建备注结束 ---

            // --- 只有包含有效网盘URL时才推送视频 ---
            if (ids && ids.length > 0) { // 检查ids数组是否不为空
                videoList.push(video);
            }
            // --- 检查结束 ---
        }
    } catch (error) {
        console.error('getTGList解析错误:', {
            url: url,
            error: error.message,
            stack: error.stack
        });
    }
    videoList.reverse()
    if(nextPage?.length > 0) {
     nextPage = `?${nextPage}`
    }else{
        nextPage = "0"
    }
    return {videoList, nextPage}
}

function _getAllPanUrls(html) {
    const $ = cheerio.load(html)
    const aList = $('a')
    const resultSet = new Set()  // 使用Set进行O(1)去重

    for (let i = 0; i < aList.length; i++) {
        const element = aList[i]
        const href = $(element)?.attr('href') ?? ''

        if (href && !resultSet.has(href)) {  // O(1)查找
            // 检查是否为网盘链接
            for (let j = 0; j < panUrlsExt.length; j++) {
                const domain = panUrlsExt[j]
                if (href.includes(domain)) {
                    resultSet.add(href);  // O(1)添加
                    break;  // 找到匹配就跳出
                }
            }
        }
    }

    return Array.from(resultSet);  // 转换回数组
}

/**
 * 获取二级分类视频列表 或 筛选视频列表
 * @param {UZSubclassVideoListArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function getSubclassVideoList(args) {
    var backData = new RepVideoList()
    try {
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取视频详情
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoDetail())>}
 */
async function getVideoDetail(args) {
    var backData = new RepVideoDetail()
    try {
        backData.data = {
            panUrls: JSON.parse(args.url),
        }
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取视频的播放地址
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoPlayUrl())>}
 */
async function getVideoPlayUrl(args) {
    var backData = new RepVideoPlayUrl()
    try {
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

const _searchListPageMap = {}
/**
 * 搜索视频
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function searchVideo(args) {
    var backData = new RepVideoList()
    try {
        // 初始化频道列表（仅首次执行）
        await initChannels()

        const channels = appConfig._channels.map((channel) => {
            return channel.id
        })

        // 🚀 核心优化：并发请求所有频道
        const searchPromises = channels.map(async (element) => {
            let endUrl = appConfig.webSite + element + "?q=" + args.searchWord

            if(args.page == 1) {
                _searchListPageMap[element] = ""
            } else {
                const nextPage = _searchListPageMap[element] ?? ""
                if(nextPage.length == 0 || nextPage == "0") {
                    return { videoList: [], nextPage: "0", channel: element }
                }
                endUrl += nextPage
            }

            try {
                const res = await getTGList(endUrl, true)
                _searchListPageMap[element] = res.nextPage
                return {
                    videoList: res.videoList,
                    nextPage: res.nextPage,
                    channel: element
                }
            } catch (error) {
                console.error(`频道 ${element} 搜索失败:`, error)
                return { videoList: [], nextPage: "0", channel: element }
            }
        })

        // 🚀 并发执行所有请求，设置8秒超时防止慢请求拖累整体性能
        const results = await Promise.allSettled(
            searchPromises.map(promise =>
                Promise.race([
                    promise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('请求超时')), 8000)
                    )
                ])
            )
        )

        // 处理并发结果
        const allVideos = []
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.videoList) {
                // 为当前频道的结果去重
                const deduplicatedPageVideos = deduplicateVideoListByLinks(result.value.videoList);
                allVideos.push(...deduplicatedPageVideos)
            } else if (result.status === 'rejected') {
                console.error(`频道 ${channels[index]} 请求失败:`, result.reason)
            }
        })

        // 🚀 最终跨频道去重
        backData.data = deduplicateVideoListByLinks(allVideos)

    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

// --- 去重函数 ---
function deduplicateVideoListByLinks(videoList) {
    const map = new Map();
    for (const video of videoList) {
        let ids;
        try {
            // video.vod_id 是一个字符串化的数组，将其解析回来
            ids = JSON.parse(video.vod_id || '[]');
            if (!Array.isArray(ids)) {
                ids = []; // 确保它是一个数组
            }
        } catch (e) {
            ids = []; // 处理解析错误
        }

        // 通过在字符串化之前对ID进行排序来创建稳定的键
        const key = JSON.stringify(ids.sort());

        // 如果键不存在，或者当前视频的message_id更大
        if (!map.has(key) || (video.message_id > (map.get(key)?.message_id || 0))) {
            map.set(key, video);
        }
    }
    return Array.from(map.values());
}
// --- 去重函数结束 ---
