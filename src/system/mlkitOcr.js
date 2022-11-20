import { similarity } from "@/common/tool";
import { isRoot } from "@auto.pro/core";
import drawFloaty from "./drawFloaty";

export const ocr = {
    /**
     * 获取ocr是否安装
     */
    isInstalled: function () {
        try { 
            $plugins.load('org.autojs.autojspro.plugin.mlkit.ocr');
        } catch (e) {
            console.error(e);
            return false;
        }
        return true;
    },

    /**
     * 安装
     */
    install: function (option) {
        let self = this;
        if (app.autojs.versionCode < '9130600') {
            toastLog('软件版本过低，当前版本不支持ocr请安装新版');
            option.failCallback();
            return;
        }
        dialogs.confirm('提示', '大约消耗11Mb，是否下载OCR扩展？', function (cr) {
            if (cr) {
                try {
                    threads.start(function () {
                        try {
                            toastLog('下载中，请稍后...');
                            // const path = context.getExternalFilesDir(null).getAbsolutePath() + '/assttyus_ng/ocr';
                            const path = files.cwd() + '/plugins'
                            let url = 'https://assttyys.zzliux.cn/static/autojspro-mlkit-ocr-plugin-1.1.apk';
                            const r = http.get(url);
                            console.log(`下载路径${path}`);
                            files.ensureDir(path + '/autojspro-mlkit-ocr-plugin-1.1.apk');
                            if (files.exists(path + '/autojspro-mlkit-ocr-plugin-1.1.apk')) {
                                files.remove(path + '/autojspro-mlkit-ocr-plugin-1.1.apk');
                            }
                            files.writeBytes(path + '/org.autojs.autojspro.plugin.mlkit.ocr.apk', r.body.bytes());
                            if (ocr.isInstalled()) {
                                toastLog('安装完成');
                                option.successCallback();
                            } else {
                                toastLog('安装出错');
                                option.failCallback();
                            }
                            // if (isRoot) {
                            //     shell('install -t ' + path + '/autojspro-mlkit-ocr-plugin-1.1.apk', true);
                            // } else {
                                // app.viewFile(path + '/autojspro-mlkit-ocr-plugin-1.1.apk');
                            // }
                        } catch (e) {
                            toast(e);
                            console.error($debug.getStackTrace(e));
                            option.failCallback();
                        }
                    });
                } catch (e) {
                    toast(e);
                    console.error($debug.getStackTrace(e));
                    option.failCallback();
                }
            } else {
                option.failCallback();
            }
        });
    },

    prepare: function () {
        function detectOcr () {
            const MLKitOCR = $plugins.load('org.autojs.autojspro.plugin.mlkit.ocr');
            const instacne = new MLKitOCR();
            this.loadImage = function (bitmap) {
                const ajImg = com.stardust.autojs.core.image.ImageWrapper.ofBitmap(bitmap);
                console.time('ocr.detect');
                const resultOrigin = instacne.detect(ajImg);
                console.timeEnd('ocr.detect');
                ajImg.recycle();
                const result = resultOrigin.map(item => {
                    return {
                        confidence: item.confidence,
                        label: item.text,
                        rotation: item.rotation,
                        points: [{
                            // 左上
                            x: item.bounds.left,
                            y: item.bounds.top
                        }, {
                            // 右上
                            x: item.bounds.right,
                            y: item.bounds.top
                        }, {
                            // 右下
                            x: item.bounds.right,
                            y: item.bounds.bottom
                        }, {
                            // 左下
                            x: item.bounds.left,
                            y: item.bounds.bottom
                        }]
                    }
                });
                return result;
            }
        }
        return new detectOcr();
    },

    findTextByOcr(detector, getBmpFunc, text, timeout, region, textMatchMode) {
        const startTime = new Date().getTime();
        while (true) {
            console.time('ocr.detect');
            let bmp = getBmpFunc();
            if (region) {
                let newBmp = android.graphics.Bitmap.createBitmap(bmp, region[0], region[1], region[2] - region[0], region[3] - region[1]);
                bmp.recycle();
                bmp = newBmp;
            }
            let rs = detector.loadImage(bmp);
            bmp.recycle()
            console.timeEnd('ocr.detect');

            if (region) {
                rs.forEach(item => {
                    item.points.forEach(point => {
                        point.x += region[0];
                        point.y += region[1];
                    })
                });
            }
            
            let res = [];
            let toDraw = [];
            if (textMatchMode === '包含') {
                let reg = new RegExp(text);
                res = rs.filter(item => reg.test(item.label));
                toDraw = rs.map(item => ({
                    region: [item.points[0].x, item.points[0].y, item.points[2].x, item.points[2].y],
                    color: reg.test(item.label) ? 'green' : 'red',
                    text: item.label + ':' + item.confidence
                }));
            } else /*if (textMatchMode === '模糊') */{
                res = rs.filter(item => similarity(item.label, text, 0.5) >= 0.5);
                toDraw = rs.map(item => ({
                    region: [item.points[0].x, item.points[0].y, item.points[2].x, item.points[2].y],
                    color: similarity(item.label, text, 0.5) >= 0.5 ? 'green' : 'red',
                    text: item.label + ':' + item.confidence
                }));
            }
    
            
            // 开了绘制有可能绘制内容也被ocr给识别了
            if (drawFloaty.instacne) {
                drawFloaty.draw(toDraw, 200);
            }
    
            if (res.length > 0) {
                console.log('识别结果', JSON.stringify(rs));
                return res;
            } else if (new Date().getTime() - startTime > timeout) {
                return [];
            }
        }
    }
}