const MODEL_URL = "./js/face-api/models";

// default constraints
const constraints = {
    audio: true,
    video: { width: { min: 400, ideal: 600, max: 1200 }, height: { min: 400, ideal: 600, max: 1200 }, frameRate: 20 },
};

// default resolution
const resolution = [
    { width: { exact: 1200 }, height: { exact: 1200 } },
    { width: { exact: 1000 }, height: { exact: 1000 } },
    { width: { exact: 800 }, height: { exact: 800 } },
    { width: { exact: 600 }, height: { exact: 600 } },
    { width: { exact: 400 }, height: { exact: 400 } },
];

// video element
const videoInput = document.getElementById("video");

class FaceCheck {
    constructor() {
        this.modelUrl = MODEL_URL;
        this.isFaceInBox = false;
        this.index = 0;
        this.constraints = constraints;
        this.resolution = resolution;
        this.faceRect = { width: 300, height: 300 }; // 人臉框大小，預設300*300
        this.facePosition = { top: 0, left: 0, right: 0, bottom: 0 }; // 人臉框定位

        this.onInit();
    }

    onInit() {
        // 載入模型
        Promise.all([
            // faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelUrl),
            faceapi.nets.tinyFaceDetector.loadFromUri(this.modelUrl),
        ]).then(() => {
            this.startVideo();
        });

        videoInput.addEventListener("play", this.detect.bind(this));
    }

    startVideo() {
        this.constraints.video.width = this.resolution[this.index].width;
        this.constraints.video.height = this.resolution[this.index].height;

        navigator.mediaDevices
            .getUserMedia(this.constraints)
            .then((stream) => this.successCallback(stream))
            .catch((error) => this.errorCallback(error));
    }

    stopStream() {
        if (window.stream) {
            window.stream.getTracks().forEach((stream) => {
                stream.stop();
                // stream.enabled = false;
            });

            // inputVideo.src = inputVideo.srcObject = null;
        }
    }

    detect() {
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.width = videoInput.style.width;
        canvas.style.height = videoInput.style.height;
        document.getElementsByClassName("content")[0].append(canvas);

        // 配置顯示尺寸
        const displaySize = { width: videoInput.width, height: videoInput.height };
        faceapi.matchDimensions(canvas, displaySize);

        // 成功偵測人臉次數
        let getFaceCount = 0;

        // 每 1000ms 繪製一次
        let id = setInterval(async () => {
            // 識別人臉位置
            // const detections = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options());
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());

            if (detections) {
                // 调整尺寸
                const resizedDetections = faceapi.resizeResults(detections, displaySize);

                // 判斷人臉是否在畫布內
                const detectBox = detections.box;

                if (
                    detectBox.top > this.facePosition.top &&
                    detectBox.left > this.facePosition.left &&
                    detectBox.right < this.facePosition.right &&
                    detectBox.bottom < this.facePosition.bottom
                ) {
                    this.isFaceInBox = true;
                    getFaceCount++;
                    document.getElementById("title").innerHTML = "偵測中，請勿亂動";
                } else {
                    this.isFaceInBox = false;
                    getFaceCount = 0;
                    document.getElementById("title").innerHTML = "請將臉部放置在籃框中";
                }

                canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); // 清空畫布
                faceapi.draw.drawDetections(canvas, resizedDetections); // 繪製檢測框
            } else {
                this.isFaceInBox = false;
                getFaceCount = 0;
                canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); // 清空畫布
                document.getElementById("title").innerHTML = "未偵測到臉部";
            }

            // 連續3次成功偵測人臉即截圖
            if (this.isFaceInBox && getFaceCount === 6) {
                this.getFaceImage(); // 截圖
                this.stopStream(); // 停止串流
                canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); // 清空畫布
                clearInterval(id); // 清除計時器
            }
        }, 500);
    }

    async successCallback(stream) {
        this.index = 0;

        window.stream = stream;

        let width = stream.getVideoTracks()[0].getSettings().width;
        let height = stream.getVideoTracks()[0].getSettings().height;

        videoInput.width = width;
        videoInput.height = height;

        // 如果裝置寬度小於影像解析度，將影像縮小(非解析度)為裝置寬度(1:1)
        let videoClientWidth = videoInput.getClientRects()[0].width;

        if (videoClientWidth < width) {
            videoInput.style.width = `${videoClientWidth}px`;
            videoInput.style.height = `${videoClientWidth}px`;
        }

        // 人像框占比1/2
        this.faceRect.width = (width * 2) / 3;
        this.faceRect.height = (height * 2) / 3;

        if ("srcObject" in videoInput) {
            videoInput.srcObject = stream;
            videoInput.playsInline = true;

            await videoInput.play();
        } else {
            videoInput.src = window.URL.createObjectURL(stream);
        }

        // 繪製人臉框範圍
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.style.position = "absolute";

        // 解析度與影像解析度相同
        canvas.width = width;
        canvas.height = height;

        // 畫布尺寸與影像尺寸相同
        canvas.style.width = videoInput.style.width;
        canvas.style.height = videoInput.style.height;

        // 人臉框放置畫布正中間
        let x = width / 2 - this.faceRect.width / 2;
        let y = height / 2 - this.faceRect.height / 2;

        ctx.beginPath();
        ctx.lineWidth = 8;
        ctx.setLineDash([20, 10]); // 虛線[長，空格]
        ctx.strokeStyle = "#80BCBD";
        ctx.strokeRect(x, y, this.faceRect.width, this.faceRect.height);
        ctx.closePath();

        // 儲存人臉框定位
        this.facePosition = { top: y, left: x, right: x + this.faceRect.width, bottom: y + this.faceRect.height };

        document.getElementsByClassName("content")[0].append(canvas);
    }

    async errorCallback(error) {
        console.log("navigator.getUserMedia error: ", error);

        if (this.index >= this.resolution.length - 1) {
            alert("此裝置無可支援的解析度");
            return;
        }

        // 錯誤時，嘗試下一個解析度
        this.index++;
        this.startVideo();
    }

    // 擷取人臉圖像
    getFaceImage() {
        const screenShot = document.createElement("canvas");
        screenShot.width = this.faceRect.width;
        screenShot.height = this.faceRect.height;
        screenShot.style.width = videoInput.style.width;
        screenShot.style.height = videoInput.style.height;
        const ctx = screenShot.getContext("2d");
        ctx.drawImage(
            videoInput,
            this.facePosition.left,
            this.facePosition.top,
            this.faceRect.width,
            this.faceRect.height,
            0,
            0,
            this.faceRect.width,
            this.faceRect.height
        );

        document.getElementsByClassName("result")[0].append(screenShot);
    }
}

const faceCheck = new FaceCheck();
export default faceCheck;
