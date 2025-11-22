const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = 1000;
const HEIGHT = 500;

const LANE_COUNT = 5;
const LANE_HEIGHT = HEIGHT / LANE_COUNT;

const WHITE = "#FFFFFF";
const GRAY = "#2a2a3e";
const YELLOW = "#FFD700";
const RED = "#FF4757";
const BLUE = "#5352ed";
const BLACK = "#000000";
const DARK_GRAY = "#1a1a2e";
const LIGHT_GRAY = "#3a3a4e";

const car_width = 40;
const car_height = 30;

const obstacle_width = 40;
const obstacle_height = 30;

let car_x = 80;
let car_y = HEIGHT / 2;

let target_lane = Math.floor(LANE_COUNT / 2);
let lane_change_speed = 5;

let base_obstacle_speed = 3;
let detection_distance = 130;
let side_detection_distance = 150;
let speed_factor = 1.0;

let obstacles = [];
let last_spawn_time = 0;
let spawn_interval = 600; // 장애물 빈도 증가 (1200 -> 600ms)
let max_speed_factor = 2.0; // 최대 속도 증가

let stop_start_time = null;
let running = true;
let road_offset = 0; // 차선 스크롤 오프셋
let frame_count = 0; // 프레임 카운트

// ======================
// 그리기 함수
// ======================
function drawLanes() {
    // 도로 배경
    for (let i = 0; i < LANE_COUNT; i++) {
        const gradient = ctx.createLinearGradient(0, i * LANE_HEIGHT, 0, (i + 1) * LANE_HEIGHT);
        gradient.addColorStop(0, i % 2 === 0 ? GRAY : LIGHT_GRAY);
        gradient.addColorStop(1, i % 2 === 0 ? LIGHT_GRAY : GRAY);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, i * LANE_HEIGHT, WIDTH, LANE_HEIGHT);
    }

    // 가로 차선 (자동차와 평행하게 - 왼쪽으로 스크롤)
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 3;
    const dashLength = 30;
    const dashGap = 20;
    const dashTotal = dashLength + dashGap;
    
    ctx.setLineDash([dashLength, dashGap]);
    
    // 각 차선의 아래쪽에 가로 점선 그리기 (자동차 아래)
    for (let i = 0; i < LANE_COUNT; i++) {
        const laneY = i * LANE_HEIGHT;
        const laneCenterY = laneY + LANE_HEIGHT * 0.7; // 차선을 아래로 이동 (0.5 -> 0.7)
        const offsetX = (road_offset % dashTotal);
        
        // 왼쪽으로 스크롤되는 가로 점선 (자동차 이동 방향과 평행)
        let x = -offsetX;
        while (x < WIDTH + dashTotal) {
            ctx.beginPath();
            ctx.moveTo(x, laneCenterY);
            ctx.lineTo(x + dashLength, laneCenterY);
            ctx.stroke();
            x += dashTotal;
        }
    }
    ctx.setLineDash([]);
    
    // 도로 가장자리
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(WIDTH, 0);
    ctx.moveTo(0, HEIGHT);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.stroke();
}

function drawCar(x, y) {
    ctx.save();
    ctx.translate(x + car_width / 2, y + car_height / 2);
    
    // 그림자
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, car_height / 2 + 3, car_width / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 자동차 본체 (그라데이션)
    const carGradient = ctx.createLinearGradient(-car_width / 2, -car_height / 2, -car_width / 2, car_height / 2);
    carGradient.addColorStop(0, "#6c5ce7");
    carGradient.addColorStop(0.5, BLUE);
    carGradient.addColorStop(1, "#4834d4");
    ctx.fillStyle = carGradient;
    
    // 자동차 모양 (둥근 모서리)
    ctx.beginPath();
    const radius = 5;
    ctx.moveTo(-car_width / 2 + radius, -car_height / 2);
    ctx.lineTo(car_width / 2 - radius, -car_height / 2);
    ctx.quadraticCurveTo(car_width / 2, -car_height / 2, car_width / 2, -car_height / 2 + radius);
    ctx.lineTo(car_width / 2, car_height / 2 - radius);
    ctx.quadraticCurveTo(car_width / 2, car_height / 2, car_width / 2 - radius, car_height / 2);
    ctx.lineTo(-car_width / 2 + radius, car_height / 2);
    ctx.quadraticCurveTo(-car_width / 2, car_height / 2, -car_width / 2, car_height / 2 - radius);
    ctx.lineTo(-car_width / 2, -car_height / 2 + radius);
    ctx.quadraticCurveTo(-car_width / 2, -car_height / 2, -car_width / 2 + radius, -car_height / 2);
    ctx.closePath();
    ctx.fill();
    
    // 테두리
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 창문
    ctx.fillStyle = "rgba(135, 206, 250, 0.4)";
    ctx.fillRect(-car_width / 2 + 8, -car_height / 2 + 5, car_width - 16, car_height / 2 - 3);
    
    // 바퀴
    ctx.fillStyle = "#2c2c54";
    const wheelWidth = 6;
    const wheelHeight = 8;
    // 왼쪽 앞바퀴
    ctx.fillRect(-car_width / 2 - 2, -car_height / 2 - 2, wheelWidth, wheelHeight);
    // 오른쪽 앞바퀴
    ctx.fillRect(car_width / 2 - 4, -car_height / 2 - 2, wheelWidth, wheelHeight);
    // 왼쪽 뒷바퀴
    ctx.fillRect(-car_width / 2 - 2, car_height / 2 - 6, wheelWidth, wheelHeight);
    // 오른쪽 뒷바퀴
    ctx.fillRect(car_width / 2 - 4, car_height / 2 - 6, wheelWidth, wheelHeight);
    
    // 헤드라이트
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(car_width / 2 - 5, -car_height / 2 + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(car_width / 2 - 5, car_height / 2 - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 반사광 효과
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.ellipse(-car_width / 4, -car_height / 3, car_width / 3, car_height / 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// 장애물 자동차 그리기 (3가지 디자인)
function drawObstacleCar(x, y, carType) {
    ctx.save();
    ctx.translate(x + obstacle_width / 2, y + obstacle_height / 2);
    
    // 그림자
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, obstacle_height / 2 + 3, obstacle_width / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 자동차 타입에 따른 색상 및 디자인
    let carGradient, accentColor, detailColor;
    
    switch(carType) {
        case 0: // 빨간 스포츠카
            carGradient = ctx.createLinearGradient(-obstacle_width / 2, -obstacle_height / 2, -obstacle_width / 2, obstacle_height / 2);
            carGradient.addColorStop(0, "#ff6b6b");
            carGradient.addColorStop(0.5, "#ff4757");
            carGradient.addColorStop(1, "#c92a2a");
            accentColor = "#ffd700";
            detailColor = "#fff";
            break;
        case 1: // 노란 세단
            carGradient = ctx.createLinearGradient(-obstacle_width / 2, -obstacle_height / 2, -obstacle_width / 2, obstacle_height / 2);
            carGradient.addColorStop(0, "#ffd93d");
            carGradient.addColorStop(0.5, "#feca57");
            carGradient.addColorStop(1, "#ff9ff3");
            accentColor = "#2c2c54";
            detailColor = "#fff";
            break;
        case 2: // 초록 SUV
            carGradient = ctx.createLinearGradient(-obstacle_width / 2, -obstacle_height / 2, -obstacle_width / 2, obstacle_height / 2);
            carGradient.addColorStop(0, "#00d2d3");
            carGradient.addColorStop(0.5, "#01a3a4");
            carGradient.addColorStop(1, "#006266");
            accentColor = "#ffd700";
            detailColor = "#fff";
            break;
    }
    
    // 자동차 본체
    ctx.fillStyle = carGradient;
    const radius = 5;
    ctx.beginPath();
    ctx.moveTo(-obstacle_width / 2 + radius, -obstacle_height / 2);
    ctx.lineTo(obstacle_width / 2 - radius, -obstacle_height / 2);
    ctx.quadraticCurveTo(obstacle_width / 2, -obstacle_height / 2, obstacle_width / 2, -obstacle_height / 2 + radius);
    ctx.lineTo(obstacle_width / 2, obstacle_height / 2 - radius);
    ctx.quadraticCurveTo(obstacle_width / 2, obstacle_height / 2, obstacle_width / 2 - radius, obstacle_height / 2);
    ctx.lineTo(-obstacle_width / 2 + radius, obstacle_height / 2);
    ctx.quadraticCurveTo(-obstacle_width / 2, obstacle_height / 2, -obstacle_width / 2, obstacle_height / 2 - radius);
    ctx.lineTo(-obstacle_width / 2, -obstacle_height / 2 + radius);
    ctx.quadraticCurveTo(-obstacle_width / 2, -obstacle_height / 2, -obstacle_width / 2 + radius, -obstacle_height / 2);
    ctx.closePath();
    ctx.fill();
    
    // 테두리
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 창문
    ctx.fillStyle = "rgba(135, 206, 250, 0.4)";
    ctx.fillRect(-obstacle_width / 2 + 8, -obstacle_height / 2 + 5, obstacle_width - 16, obstacle_height / 2 - 3);
    
    // 바퀴
    ctx.fillStyle = "#2c2c54";
    const wheelWidth = 6;
    const wheelHeight = 8;
    ctx.fillRect(-obstacle_width / 2 - 2, -obstacle_height / 2 - 2, wheelWidth, wheelHeight);
    ctx.fillRect(obstacle_width / 2 - 4, -obstacle_height / 2 - 2, wheelWidth, wheelHeight);
    ctx.fillRect(-obstacle_width / 2 - 2, obstacle_height / 2 - 6, wheelWidth, wheelHeight);
    ctx.fillRect(obstacle_width / 2 - 4, obstacle_height / 2 - 6, wheelWidth, wheelHeight);
    
    // 헤드라이트/테일라이트
    ctx.fillStyle = detailColor;
    ctx.beginPath();
    ctx.arc(obstacle_width / 2 - 5, -obstacle_height / 2 + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obstacle_width / 2 - 5, obstacle_height / 2 - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 타입별 특별 디테일
    if (carType === 0) {
        // 스포츠카 - 스트라이프
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-obstacle_width / 2 + 10, -obstacle_height / 4);
        ctx.lineTo(obstacle_width / 2 - 10, -obstacle_height / 4);
        ctx.stroke();
    } else if (carType === 1) {
        // 세단 - 루프랙
        ctx.fillStyle = accentColor;
        ctx.fillRect(-obstacle_width / 2 + 5, -obstacle_height / 2 - 1, obstacle_width - 10, 2);
    } else if (carType === 2) {
        // SUV - 지붕 박스
        ctx.fillStyle = accentColor;
        ctx.fillRect(-obstacle_width / 4, -obstacle_height / 2 - 3, obstacle_width / 2, 3);
    }
    
    // 반사광 효과
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.ellipse(-obstacle_width / 4, -obstacle_height / 3, obstacle_width / 3, obstacle_height / 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawObstacles() {
    obstacles.forEach(obs => {
        drawObstacleCar(obs.x, obs.y, obs.carType);
    });
}

function drawSpeed() {
    // 배경 패널
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, 10, 180, 50);
    
    // 테두리
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 180, 50);
    
    // 속도 텍스트
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`Speed: ${speed_factor.toFixed(2)}x`, 20, 35);
    
    // 속도 바
    const barWidth = 160;
    const barHeight = 8;
    const barX = 20;
    const barY = 45;
    
    // 배경
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 속도 표시
    const speedGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    speedGradient.addColorStop(0, "#00d2ff");
    speedGradient.addColorStop(0.5, "#3a7bd5");
    speedGradient.addColorStop(1, "#00d2ff");
    ctx.fillStyle = speedGradient;
    ctx.fillRect(barX, barY, barWidth * speed_factor, barHeight);
    
    // 속도 바 테두리
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
}

// =================
// 장애물 생성
// =================
function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const speed = base_obstacle_speed + Math.random() * 2;
    const carType = Math.floor(Math.random() * 3); // 0, 1, 2 중 랜덤

    const x = WIDTH + Math.random() * 200;
    const y = lane * LANE_HEIGHT + LANE_HEIGHT / 2 - obstacle_height / 2;

    obstacles.push({ 
        x, 
        y, 
        speed, 
        lane, 
        carType,
        targetLane: lane,
        lastLaneChange: 0,
        currentSpeed: speed
    });
}

// 장애물 자동차가 다른 장애물 감지
function detectObstacleFront(obstacle, lane) {
    return obstacles.some(obs => {
        if (obs === obstacle) return false;
        return obs.lane === lane &&
               obs.x < obstacle.x &&
               obs.x > obstacle.x - 150 &&
               Math.abs(obs.x - obstacle.x) < 150;
    });
}

// 장애물 자동차가 옆 차선 감지
function detectObstacleSide(obstacle, lane) {
    return obstacles.some(obs => {
        if (obs === obstacle) return false;
        return obs.lane === lane &&
               obs.x < obstacle.x &&
               obs.x > obstacle.x - 100;
    });
}

// 장애물 자동차 자율주행
function autonomousObstacleDrive(obstacle, frameCount) {
    const canChangeLane = (frameCount - obstacle.lastLaneChange) >= 20;
    
    // 앞에 장애물이 있는지 확인
    if (detectObstacleFront(obstacle, obstacle.lane)) {
        // 감속
        obstacle.currentSpeed = Math.max(obstacle.speed * 0.5, obstacle.currentSpeed * 0.98);
        
        // 차선 변경 시도
        if (canChangeLane) {
            let possible = [];
            
            // 왼쪽 차선 체크
            if (obstacle.lane > 0 && !detectObstacleSide(obstacle, obstacle.lane - 1)) {
                possible.push(obstacle.lane - 1);
            }
            
            // 오른쪽 차선 체크
            if (obstacle.lane < LANE_COUNT - 1 && !detectObstacleSide(obstacle, obstacle.lane + 1)) {
                possible.push(obstacle.lane + 1);
            }
            
            if (possible.length > 0) {
                obstacle.targetLane = possible[Math.floor(Math.random() * possible.length)];
                obstacle.lastLaneChange = frameCount;
            }
        }
    } else {
        // 앞이 비어있으면 가속
        obstacle.currentSpeed = Math.min(obstacle.speed, obstacle.currentSpeed * 1.02);
    }
    
    // 차선 변경
    if (obstacle.lane !== obstacle.targetLane) {
        const targetY = obstacle.targetLane * LANE_HEIGHT + LANE_HEIGHT / 2 - obstacle_height / 2;
        const dy = targetY - obstacle.y;
        obstacle.y += dy * 0.1;
        
        // 차선 변경 완료
        if (Math.abs(dy) < 2) {
            obstacle.lane = obstacle.targetLane;
        }
    }
}

// 장애물 자동차끼리 충돌 체크
function checkObstacleCollisions() {
    for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
            const obs1 = obstacles[i];
            const obs2 = obstacles[j];
            
            // 같은 차선에 있고 거리가 가까우면
            if (obs1.lane === obs2.lane) {
                const dist = Math.abs(obs1.x - obs2.x);
                if (dist < obstacle_width + 10) {
                    // 충돌 방지를 위해 한쪽을 약간 이동
                    if (obs1.x < obs2.x) {
                        obs1.x -= 2;
                        obs2.x += 2;
                    } else {
                        obs1.x += 2;
                        obs2.x -= 2;
                    }
                }
            }
        }
    }
}

// 장애물 이동
function moveObstacles() {
    obstacles.forEach(obs => {
        // 자율주행 로직
        autonomousObstacleDrive(obs, frame_count);
        
        // 이동
        obs.x -= obs.currentSpeed * speed_factor;
    });
    
    // 장애물 자동차끼리 충돌 체크
    checkObstacleCollisions();

    obstacles = obstacles.filter(obs => obs.x + obstacle_width > 0);
}

// 충돌 체크
function checkCollision() {
    const carRect = {
        x: car_x + 5,
        y: car_y + 5,
        w: car_width - 10,
        h: car_height - 10
    };

    for (let obs of obstacles) {
        if (
            carRect.x < obs.x + obstacle_width &&
            carRect.x + carRect.w > obs.x &&
            carRect.y < obs.y + obstacle_height &&
            carRect.y + carRect.h > obs.y
        ) {
            return true;
        }
    }
    return false;
}

// 앞 감지
function detectFront(lane) {
    return obstacles.some(obs =>
        obs.lane === lane &&
        obs.x - (car_x + car_width) > 0 &&
        obs.x - (car_x + car_width) < detection_distance
    );
}

// 좌우 감지
function detectSide(lane) {
    return obstacles.some(obs =>
        obs.lane === lane &&
        obs.x - (car_x + car_width) > 0 &&
        obs.x - (car_x + car_width) < side_detection_distance
    );
}

// ======================
// 메인 루프
// ======================
function gameLoop(timestamp) {
    if (!running) return;

    const now = Date.now();
    frame_count++;

    // 차선 스크롤 업데이트 (속도에 비례, 일정하게)
    road_offset += speed_factor * 2.5;
    if (road_offset >= 50) {
        road_offset = 0;
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawLanes();

    // 장애물 생성 (빈도 증가)
    if (now - last_spawn_time > spawn_interval) {
        // 여러 개의 장애물을 동시에 생성할 수도 있음
        spawnObstacle();
        // 30% 확률로 추가 장애물 생성
        if (Math.random() < 0.3) {
            spawnObstacle();
        }
        last_spawn_time = now;
    }

    moveObstacles();

    // =====================
    // 차선 변경 로직
    // =====================
    if (detectFront(target_lane)) {
        speed_factor = Math.max(speed_factor - 0.02, 0.5);

        let possible = [];

        if (target_lane > 0 && !detectSide(target_lane - 1)) possible.push(target_lane - 1);
        if (target_lane < LANE_COUNT - 1 && !detectSide(target_lane + 1)) possible.push(target_lane + 1);

        if (possible.length > 0) {
            target_lane = possible[Math.floor(Math.random() * possible.length)];
        } else {
            if (stop_start_time === null) stop_start_time = now;
        }
    } else {
        // 장애물이 없을 때 속도 점진적 증가
        speed_factor = Math.min(speed_factor + 0.015, max_speed_factor);
        stop_start_time = null;
    }

    // 완전 막힘 시 초기화
    if (stop_start_time !== null && now - stop_start_time > 3000) {
        obstacles = [];
        stop_start_time = null;
    }

    // 부드러운 차선 이동 (차선 정중앙)
    const target_y = target_lane * LANE_HEIGHT + LANE_HEIGHT / 2 - car_height / 2;
    if (Math.abs(car_y - target_y) > 1) {
        car_y += (target_y - car_y) / lane_change_speed;
    }

    drawCar(car_x, car_y);
    drawObstacles();
    drawSpeed();

    if (checkCollision()) {
        // 충돌 효과
        ctx.save();
        ctx.translate(car_x + car_width / 2, car_y + car_height / 2);
        
        // 빨간 테두리
        ctx.strokeStyle = "#FF4757";
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#FF4757";
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(car_width, car_height) / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        
        // 경고 텍스트
        ctx.fillStyle = "#FF4757";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚠ COLLISION ⚠", 0, -40);
        
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
