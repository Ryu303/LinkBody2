import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Info, 
  Activity,
  ArrowRight,
  Sparkles
} from 'lucide-react';

// Import silhouettes
import sideSilhouette from './assets/side_posture_silhouette.png';
import frontSilhouette from './assets/front_posture_silhouette.png';

const PostureAnalyzer = ({ onApplyResults, activeNodeId, onSelectNode }) => {
  const [viewMode, setViewMode] = useState('side'); // 'side' or 'front'
  const [sideImageSrc, setSideImageSrc] = useState(sideSilhouette);
  const [frontImageSrc, setFrontImageSrc] = useState(frontSilhouette);
  const [isSideSample, setIsSideSample] = useState(true);
  const [isFrontSample, setIsFrontSample] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // side landmarks (percentage-based)
  const [sideLandmarks, setSideLandmarks] = useState({
    ear: { x: 46.5, y: 13.5, label: '귀 (이도)' },
    shoulder: { x: 49.5, y: 26.0, label: '어깨 (견봉)' },
    pelvisBack: { x: 44.0, y: 52.0, label: '골반 후방 (PSIS)' },
    pelvisFront: { x: 53.0, y: 52.0, label: '골반 전방 (ASIS)' },
    knee: { x: 48.0, y: 73.0, label: '무릎 (슬관절)' },
    ankle: { x: 50.5, y: 91.5, label: '발목 (외측 복사뼈)' },
  });

  // front landmarks (percentage-based)
  const [frontLandmarks, setFrontLandmarks] = useState({
    leftEar: { x: 46.0, y: 14.0, label: '좌측 귀' },
    rightEar: { x: 54.0, y: 14.0, label: '우측 귀' },
    leftShoulder: { x: 40.5, y: 26.5, label: '좌측 어깨' },
    rightShoulder: { x: 59.5, y: 26.5, label: '우측 어깨' },
    leftHip: { x: 42.5, y: 51.5, label: '좌측 골반 (ASIS)' },
    rightHip: { x: 57.5, y: 51.5, label: '우측 골반 (ASIS)' },
    leftKnee: { x: 43.5, y: 72.5, label: '좌측 무릎' },
    rightKnee: { x: 56.5, y: 72.5, label: '우측 무릎' },
    leftAnkle: { x: 44.5, y: 91.0, label: '좌측 발목' },
    rightAnkle: { x: 55.5, y: 91.0, label: '우측 발목' },
  });

  const [activePoint, setActivePoint] = useState(null);

  // Update dimensions when image loaded or window resized
  const updateDimensions = () => {
    if (imageRef.current) {
      setDimensions({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // MediaPipe AI Model refs & hooks
  const poseRef = useRef(null);
  const detectModeRef = useRef('side');

  useEffect(() => {
    if (window.Pose) {
      console.log("Initializing MediaPipe Pose model...");
      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      pose.onResults(onPoseResults);
      poseRef.current = pose;
    } else {
      console.warn("MediaPipe Pose script CDN not available. AI detection will fall back to simulation.");
    }
  }, []);

  const onPoseResults = (results) => {
    setIsDetecting(false);
    if (!results || !results.poseLandmarks) {
      console.warn("No pose landmarks detected by MediaPipe.");
      return;
    }

    const landmarks = results.poseLandmarks;
    const mode = detectModeRef.current;

    // Normalization helper: Maps MediaPipe coordinates [0,1] to percentage [0,100]
    if (mode === 'side') {
      const getJoint = (leftIdx, rightIdx) => {
        const left = landmarks[leftIdx];
        const right = landmarks[rightIdx];
        if (!left && !right) return { x: 50, y: 50 };
        if (!left) return { x: right.x * 100, y: right.y * 100 };
        if (!right) return { x: left.x * 100, y: left.y * 100 };
        return left.visibility > right.visibility 
          ? { x: left.x * 100, y: left.y * 100 }
          : { x: right.x * 100, y: right.y * 100 };
      };

      const ear = getJoint(7, 8);
      const shoulder = getJoint(11, 12);
      const hip = getJoint(23, 24);
      const knee = getJoint(25, 26);
      const ankle = getJoint(27, 28);

      // Determine orientation (facing direction)
      const nose = landmarks[0];
      let direction = 1; // 1: facing right, -1: facing left
      if (nose && nose.visibility > 0.3) {
        direction = nose.x > (ear.x / 100) ? 1 : -1;
      }

      // Estimate PSIS and ASIS from Hip joint using orientation
      const pelvisBackX = hip.x - (direction * 4.5);
      const pelvisFrontX = hip.x + (direction * 4.5);
      const pelvisY = hip.y;

      setSideLandmarks({
        ear: { ...ear, label: '귀 (이도)' },
        shoulder: { ...shoulder, label: '어깨 (견봉)' },
        pelvisBack: { x: pelvisBackX, y: pelvisY, label: '골반 후방 (PSIS)' },
        pelvisFront: { x: pelvisFrontX, y: pelvisY, label: '골반 전방 (ASIS)' },
        knee: { ...knee, label: '무릎 (슬관절)' },
        ankle: { ...ankle, label: '발목 (외측 복사뼈)' },
      });
    } else {
      // Front Profile direct mapping (Mirrored from camera view)
      const mapPoint = (idx) => {
        const pt = landmarks[idx];
        return pt ? { x: pt.x * 100, y: pt.y * 100 } : { x: 50, y: 50 };
      };

      setFrontLandmarks({
        leftEar: { ...mapPoint(8), label: '좌측 귀' },
        rightEar: { ...mapPoint(7), label: '우측 귀' },
        leftShoulder: { ...mapPoint(12), label: '좌측 어깨' },
        rightShoulder: { ...mapPoint(11), label: '우측 어깨' },
        leftHip: { ...mapPoint(24), label: '좌측 골반 (ASIS)' },
        rightHip: { ...mapPoint(23), label: '우측 골반 (ASIS)' },
        leftKnee: { ...mapPoint(26), label: '좌측 무릎' },
        rightKnee: { ...mapPoint(25), label: '우측 무릎' },
        leftAnkle: { ...mapPoint(28), label: '좌측 발목' },
        rightAnkle: { ...mapPoint(27), label: '우측 발목' },
      });
    }
  };

  const runMediaPipeDetection = (imageSrc, mode) => {
    if (!poseRef.current) {
      console.warn("MediaPipe Pose model not initialized yet. Falling back to simulation.");
      triggerSimulatedDetectionFor(mode);
      return;
    }

    setIsDetecting(true);
    detectModeRef.current = mode;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = async () => {
      try {
        await poseRef.current.send({ image: img });
      } catch (err) {
        console.error("MediaPipe Pose inference failed:", err);
        setIsDetecting(false);
        triggerSimulatedDetectionFor(mode);
      }
    };
    img.onerror = () => {
      console.error("Failed to load image for MediaPipe Pose.");
      setIsDetecting(false);
      triggerSimulatedDetectionFor(mode);
    };
  };

  // Image Upload handler with explicit mode
  const handleImageUploadFor = (e, mode) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (mode === 'side') {
          setSideImageSrc(event.target.result);
          setIsSideSample(false);
        } else {
          setFrontImageSrc(event.target.result);
          setIsFrontSample(false);
        }
        runMediaPipeDetection(event.target.result, mode);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fallback Simulation AI Landmark Detection
  const triggerSimulatedDetectionFor = (mode) => {
    setIsDetecting(true);
    setTimeout(() => {
      setIsDetecting(false);
      if (mode === 'side') {
        setSideLandmarks({
          ear: { x: 45 + Math.random() * 3, y: 13 + Math.random() * 2, label: '귀 (이도)' },
          shoulder: { x: 48 + Math.random() * 3, y: 25 + Math.random() * 2, label: '어깨 (견봉)' },
          pelvisBack: { x: 43 + Math.random() * 2, y: 51 + Math.random() * 2, label: '골반 후방 (PSIS)' },
          pelvisFront: { x: 52 + Math.random() * 2, y: 51 + Math.random() * 2, label: '골반 전방 (ASIS)' },
          knee: { x: 47 + Math.random() * 3, y: 72 + Math.random() * 2, label: '무릎 (슬관절)' },
          ankle: { x: 49 + Math.random() * 2, y: 91 + Math.random() * 1, label: '발목 (외측 복사뼈)' },
        });
      } else {
        setFrontLandmarks({
          leftEar: { x: 45.5 + Math.random() * 1, y: 13.5 + Math.random() * 1, label: '좌측 귀' },
          rightEar: { x: 54.5 - Math.random() * 1, y: 13.5 + Math.random() * 1, label: '우측 귀' },
          leftShoulder: { x: 40.0 + Math.random() * 2, y: 26.0 + Math.random() * 2, label: '좌측 어깨' },
          rightShoulder: { x: 60.0 - Math.random() * 2, y: 26.0 + Math.random() * 2, label: '우측 어깨' },
          leftHip: { x: 42.0 + Math.random() * 1, y: 51.0 + Math.random() * 1, label: '좌측 골반 (ASIS)' },
          rightHip: { x: 58.0 - Math.random() * 1, y: 51.0 + Math.random() * 1, label: '우측 골반 (ASIS)' },
          leftKnee: { x: 43.0 + Math.random() * 1.5, y: 72.0 + Math.random() * 1.5, label: '좌측 무릎' },
          rightKnee: { x: 57.0 - Math.random() * 1.5, y: 72.0 + Math.random() * 1.5, label: '우측 무릎' },
          leftAnkle: { x: 44.0 + Math.random() * 1, y: 90.5 + Math.random() * 1, label: '좌측 발목' },
          rightAnkle: { x: 56.0 - Math.random() * 1, y: 90.5 + Math.random() * 1, label: '우측 발목' },
        });
      }
    }, 1500);
  };

  // Dragging logic
  const handleMouseDown = (pointKey) => {
    setActivePoint(pointKey);
  };

  const handleMouseMove = (e) => {
    if (!activePoint || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain percentages within bounds [0, 100]
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    if (viewMode === 'side') {
      setSideLandmarks(prev => ({
        ...prev,
        [activePoint]: { ...prev[activePoint], x, y }
      }));
    } else {
      setFrontLandmarks(prev => ({
        ...prev,
        [activePoint]: { ...prev[activePoint], x, y }
      }));
    }
  };

  const handleMouseUp = () => {
    setActivePoint(null);
  };

  // Touch Support for Mobile
  const handleTouchMove = (e) => {
    if (!activePoint || !imageRef.current) return;
    const touch = e.touches[0];
    const rect = imageRef.current.getBoundingClientRect();
    let x = ((touch.clientX - rect.left) / rect.width) * 100;
    let y = ((touch.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    if (viewMode === 'side') {
      setSideLandmarks(prev => ({
        ...prev,
        [activePoint]: { ...prev[activePoint], x, y }
      }));
    } else {
      setFrontLandmarks(prev => ({
        ...prev,
        [activePoint]: { ...prev[activePoint], x, y }
      }));
    }
  };

  // Set up global mouseup/move listeners when dragging to keep it smooth
  useEffect(() => {
    if (activePoint) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [activePoint]);

  // BIOMECHANICAL DIAGNOSTICS CALCULATOR
  const diagnostics = React.useMemo(() => {
    const aspect = dimensions.width && dimensions.height ? dimensions.width / dimensions.height : 3/4;

    const scaleCoords = (pt) => {
      if (!pt) return { x: 0, y: 0 };
      return {
        x: pt.x * aspect,
        y: pt.y
      };
    };

    // --- SIDE CALCULATIONS ---
    const ear = scaleCoords(sideLandmarks.ear);
    const shoulder = scaleCoords(sideLandmarks.shoulder);
    const pelvisBack = scaleCoords(sideLandmarks.pelvisBack);
    const pelvisFront = scaleCoords(sideLandmarks.pelvisFront);
    const knee = scaleCoords(sideLandmarks.knee);
    const ankle = scaleCoords(sideLandmarks.ankle);

    const dxHead = ear.x - shoulder.x;
    const dyHead = shoulder.y - ear.y;
    let headAngle = 0;
    if (dyHead > 0) {
      headAngle = Math.atan(dxHead / dyHead) * (180 / Math.PI);
    }
    headAngle = Math.max(0, Math.round(headAngle * 10) / 10);

    const dxPelvis = pelvisFront.x - pelvisBack.x;
    const dyPelvis = pelvisFront.y - pelvisBack.y;
    let pelvisAngle = 0;
    if (dxPelvis !== 0) {
      pelvisAngle = Math.atan(dyPelvis / dxPelvis) * (180 / Math.PI);
    }
    pelvisAngle = Math.round(pelvisAngle * 10) / 10;

    const hipMid = {
      x: (pelvisBack.x + pelvisFront.x) / 2,
      y: (pelvisBack.y + pelvisFront.y) / 2
    };
    const ux = hipMid.x - knee.x;
    const uy = hipMid.y - knee.y;
    const vx = ankle.x - knee.x;
    const vy = ankle.y - knee.y;
    const dotProduct = ux * vx + uy * vy;
    const magU = Math.sqrt(ux * ux + uy * uy);
    const magV = Math.sqrt(vx * vx + vy * vy);
    let kneeAngle = 180;
    if (magU > 0 && magV > 0) {
      const cosVal = dotProduct / (magU * magV);
      const rad = Math.acos(Math.max(-1, Math.min(1, cosVal)));
      const degree = rad * (180 / Math.PI);
      const lineXAtKneeY = hipMid.x + (ankle.x - hipMid.x) * (knee.y - hipMid.y) / (ankle.y - hipMid.y);
      const isHyperextended = knee.x < lineXAtKneeY;
      if (isHyperextended) {
        kneeAngle = 180 + (180 - degree);
      } else {
        kneeAngle = degree;
      }
    }
    kneeAngle = Math.round(kneeAngle * 10) / 10;

    const headStatus = headAngle < 15 ? 'normal' : headAngle < 25 ? 'warning' : 'critical';
    const sidePelvisStatus = pelvisAngle > 13 ? 'critical' : (pelvisAngle > 10 || pelvisAngle < 2) ? 'warning' : 'normal';
    const kneeStatus = kneeAngle > 183 ? 'critical' : kneeAngle > 181.5 ? 'warning' : 'normal';

    const sideSuspected = [];
    if (headStatus !== 'normal') sideSuspected.push('거북목(전방머리자세)');
    if (sidePelvisStatus === 'critical' || (sidePelvisStatus === 'warning' && pelvisAngle > 10)) {
      sideSuspected.push('골반 전방경사 패턴');
    }
    if (kneeStatus !== 'normal') sideSuspected.push('백니와 무릎의 보상');

    const sideMetrics = [
      {
        name: '거북목 각도 (Cervical Angle)',
        value: `${headAngle}°`,
        status: headStatus,
        desc: headAngle < 15 ? '정상 정렬 범위' : headAngle < 25 ? '거북목 초기 진입 (경추 부담 증가)' : '심각한 거북목 (목/어깨 근육 긴장)',
        guide: '귀가 어깨선보다 앞으로 나와 경추 추간판 압박이 증가하는 상태입니다.'
      },
      {
        name: '골반 경사각 (Pelvic Tilt)',
        value: `${pelvisAngle}°`,
        status: sidePelvisStatus,
        desc: pelvisAngle > 10 ? '골반 전방경사 (허리 전만 과도)' : pelvisAngle < 2 ? '골반 후방경사 (일자 허리)' : '정상 정렬 범위 (ASIS-PSIS 약 5-10° 경사)',
        guide: '골반이 앞이나 뒤로 회전하여 요추 정렬 및 코어 부하 불균형을 야기합니다.'
      },
      {
        name: '무릎 신전각 (Genu Recurvatum)',
        value: `${kneeAngle}°`,
        status: kneeStatus,
        desc: kneeAngle > 181.5 ? '백니/반반슬 (관절 과신전)' : '정상 정렬 범위 (일직선 상태)',
        guide: '무릎 관절이 뒤로 꺾여 대퇴사두근 및 무릎 후방 관절낭에 과도한 기계적 스트레스를 유발합니다.'
      }
    ];

    // --- FRONT CALCULATIONS ---
    const leftEar = scaleCoords(frontLandmarks.leftEar);
    const rightEar = scaleCoords(frontLandmarks.rightEar);
    const leftShoulder = scaleCoords(frontLandmarks.leftShoulder);
    const rightShoulder = scaleCoords(frontLandmarks.rightShoulder);
    const leftHip = scaleCoords(frontLandmarks.leftHip);
    const rightHip = scaleCoords(frontLandmarks.rightHip);

    const dxSh = rightShoulder.x - leftShoulder.x;
    const dySh = rightShoulder.y - leftShoulder.y;
    let shoulderAngle = 0;
    if (dxSh !== 0) {
      shoulderAngle = Math.atan(dySh / dxSh) * (180 / Math.PI);
    }
    shoulderAngle = Math.abs(Math.round(shoulderAngle * 10) / 10);

    const dxPel = rightHip.x - leftHip.x;
    const dyPel = rightHip.y - leftHip.y;
    let pelvisLateralAngle = 0;
    if (dxPel !== 0) {
      pelvisLateralAngle = Math.atan(dyPel / dxPel) * (180 / Math.PI);
    }
    pelvisLateralAngle = Math.abs(Math.round(pelvisLateralAngle * 10) / 10);

    const frontShoulderStatus = shoulderAngle < 2.2 ? 'normal' : shoulderAngle < 4.0 ? 'warning' : 'critical';
    const frontPelvisStatus = pelvisLateralAngle < 2.0 ? 'normal' : pelvisLateralAngle < 3.5 ? 'warning' : 'critical';

    const frontSuspected = [];
    if (frontShoulderStatus !== 'normal') {
      frontSuspected.push('요방형근과 어깨 불균형');
      frontSuspected.push('견갑골_하강_및_하방회전');
    }
    if (frontPelvisStatus !== 'normal') {
      frontSuspected.push('골반_측방경사');
    }

    const frontMetrics = [
      {
        name: '어깨 대칭 각도 (Shoulder Line)',
        value: `${shoulderAngle}°`,
        status: frontShoulderStatus,
        desc: frontShoulderStatus === 'normal' ? '대칭 정렬 상태' : frontShoulderStatus === 'warning' ? '어깨 경미한 불균형 (요방형근/승모근 긴장)' : '심각한 어깨 불균형 (견갑골 변위 유발)',
        guide: '좌우 어깨 높이 편차는 견갑골 안정화 근육의 비대칭 긴장을 나타냅니다.'
      },
      {
        name: '골반 측방 경사각 (Pelvic Lateral Angle)',
        value: `${pelvisLateralAngle}°`,
        status: frontPelvisStatus,
        desc: frontPelvisStatus === 'normal' ? '골반 좌우 대칭' : frontPelvisStatus === 'warning' ? '골반 측방 경사 (골반 높낮이 비대칭)' : '심각한 골반 비대칭 (다리 길이 차이 유발 가능)',
        guide: '골반의 한쪽 상승은 요방형근 수축 및 척추의 측만성 보상을 동반하기 쉽습니다.'
      }
    ];

    // Combine suspected nodes from BOTH side and front so they accumulate
    const combinedSuspected = Array.from(new Set([...sideSuspected, ...frontSuspected]));

    return {
      sideMetrics,
      frontMetrics,
      suspectedNodes: combinedSuspected
    };
  }, [sideLandmarks, frontLandmarks, dimensions]);

  // Apply to Map Action
  const handleApply = () => {
    onApplyResults(diagnostics.suspectedNodes);
  };

  return (
    <div className="posture-analyzer-studio" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Studio Header Controls - Dual Upload Card Tabs */}
      <div className="studio-controls-header" style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid var(--border-primary)',
        borderRadius: '12px'
      }}>
        
        {/* Dual Card Tabs */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', flex: 1 }}>
          
          {/* SIDE PROFILE CARD TAB */}
          <div 
            onClick={() => setViewMode('side')}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '280px',
              padding: '8px 12px',
              borderRadius: '10px',
              background: viewMode === 'side' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.25)',
              border: '1px solid ' + (viewMode === 'side' ? 'var(--color-local)' : 'var(--border-primary)'),
              boxShadow: viewMode === 'side' ? '0 0 15px rgba(6, 182, 212, 0.15)' : 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
              userSelect: 'none'
            }}
            className="analyzer-tab-card"
          >
            {/* Thumbnail */}
            <div style={{
              width: '42px',
              height: '54px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid ' + (viewMode === 'side' ? 'var(--color-local)' : 'rgba(255,255,255,0.1)'),
              background: '#020617',
              flexShrink: 0
            }}>
              <img 
                src={sideImageSrc} 
                alt="Side Thumbnail" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            
            {/* Info Text */}
            <div style={{ flex: 1, paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: viewMode === 'side' ? '#fff' : 'var(--text-secondary)' }}>
                측면 프로필 (Side)
              </span>
              <span style={{ 
                fontSize: '0.65rem', 
                color: isSideSample ? 'var(--text-muted)' : '#10b981', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '5px', 
                  height: '5px', 
                  borderRadius: '50%', 
                  backgroundColor: isSideSample ? 'var(--text-muted)' : '#10b981' 
                }}></span>
                {isSideSample ? '기본 모델 시안' : '사진 분석 중'}
              </span>
            </div>

            {/* Quick Actions (Upload & Reset) inside the card */}
            <div 
              style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}
              onClick={(e) => e.stopPropagation()} // Prevent card selection triggering
            >
              {/* Card Upload button */}
              <label 
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)'
                }}
                title="측면 사진 변경"
                className="hover-bright"
              >
                <Upload size={12} />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleImageUploadFor(e, 'side')} 
                  style={{ display: 'none' }} 
                />
              </label>

              {/* Reset to sample */}
              <button
                onClick={() => {
                  setIsSideSample(true);
                  setSideImageSrc(sideSilhouette);
                  setSideLandmarks({
                    ear: { x: 46.5, y: 13.5, label: '귀 (이도)' },
                    shoulder: { x: 49.5, y: 26.0, label: '어깨 (견봉)' },
                    pelvisBack: { x: 44.0, y: 52.0, label: '골반 후방 (PSIS)' },
                    pelvisFront: { x: 53.0, y: 52.0, label: '골반 전방 (ASIS)' },
                    knee: { x: 48.0, y: 73.0, label: '무릎 (슬관절)' },
                    ankle: { x: 50.5, y: 91.5, label: '발목 (외측 복사뼈)' },
                  });
                }}
                disabled={isSideSample}
                style={{ 
                  cursor: isSideSample ? 'not-allowed' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  opacity: isSideSample ? 0.3 : 1
                }}
                title="기본 시안으로 리셋"
                className="hover-bright"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* FRONT PROFILE CARD TAB */}
          <div 
            onClick={() => setViewMode('front')}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '280px',
              padding: '8px 12px',
              borderRadius: '10px',
              background: viewMode === 'front' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.25)',
              border: '1px solid ' + (viewMode === 'front' ? 'var(--color-local)' : 'var(--border-primary)'),
              boxShadow: viewMode === 'front' ? '0 0 15px rgba(6, 182, 212, 0.15)' : 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
              userSelect: 'none'
            }}
            className="analyzer-tab-card"
          >
            {/* Thumbnail */}
            <div style={{
              width: '42px',
              height: '54px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid ' + (viewMode === 'front' ? 'var(--color-local)' : 'rgba(255,255,255,0.1)'),
              background: '#020617',
              flexShrink: 0
            }}>
              <img 
                src={frontImageSrc} 
                alt="Front Thumbnail" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            
            {/* Info Text */}
            <div style={{ flex: 1, paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: viewMode === 'front' ? '#fff' : 'var(--text-secondary)' }}>
                전면 프로필 (Front)
              </span>
              <span style={{ 
                fontSize: '0.65rem', 
                color: isFrontSample ? 'var(--text-muted)' : '#10b981', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '5px', 
                  height: '5px', 
                  borderRadius: '50%', 
                  backgroundColor: isFrontSample ? 'var(--text-muted)' : '#10b981' 
                }}></span>
                {isFrontSample ? '기본 모델 시안' : '사진 분석 중'}
              </span>
            </div>

            {/* Quick Actions (Upload & Reset) inside the card */}
            <div 
              style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}
              onClick={(e) => e.stopPropagation()} // Prevent card selection triggering
            >
              {/* Card Upload button */}
              <label 
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)'
                }}
                title="전면 사진 변경"
                className="hover-bright"
              >
                <Upload size={12} />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleImageUploadFor(e, 'front')} 
                  style={{ display: 'none' }} 
                />
              </label>

              {/* Reset to sample */}
              <button
                onClick={() => {
                  setIsFrontSample(true);
                  setFrontImageSrc(frontSilhouette);
                  setFrontLandmarks({
                    leftEar: { x: 46.0, y: 14.0, label: '좌측 귀' },
                    rightEar: { x: 54.0, y: 14.0, label: '우측 귀' },
                    leftShoulder: { x: 40.5, y: 26.5, label: '좌측 어깨' },
                    rightShoulder: { x: 59.5, y: 26.5, label: '우측 어깨' },
                    leftHip: { x: 42.5, y: 51.5, label: '좌측 골반 (ASIS)' },
                    rightHip: { x: 57.5, y: 51.5, label: '우측 골반 (ASIS)' },
                    leftKnee: { x: 43.5, y: 72.5, label: '좌측 무릎' },
                    rightKnee: { x: 56.5, y: 72.5, label: '우측 무릎' },
                    leftAnkle: { x: 44.5, y: 91.0, label: '좌측 발목' },
                    rightAnkle: { x: 55.5, y: 91.0, label: '우측 발목' },
                  });
                }}
                disabled={isFrontSample}
                style={{ 
                  cursor: isFrontSample ? 'not-allowed' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  opacity: isFrontSample ? 0.3 : 1
                }}
                title="기본 시안으로 리셋"
                className="hover-bright"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

        </div>

        {/* Guidance / Description on the right */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          maxWidth: '360px'
        }}>
          <Info size={14} className="text-indigo-400" style={{ flexShrink: 0 }} />
          <span>각 프로필 카드 내의 업로드 단추로 측면과 전면 사진을 각각 등록하고 골격점들을 개별 조정할 수 있습니다.</span>
        </div>
      </div>

      {/* Main Studio Body Grid */}
      <div className="studio-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(350px, 1fr) 380px',
        gap: '20px',
        flex: 1,
        minHeight: 0
      }}>
        
        {/* Left Side: Photo & Skeleton Canvas Overlay */}
        <div 
          ref={containerRef}
          className="canvas-viewport-container" 
          style={{
            position: 'relative',
            background: '#05080f',
            border: '1px solid var(--border-primary)',
            borderRadius: '12px',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            minHeight: '400px'
          }}
        >
          {isDetecting && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(5, 8, 15, 0.8)',
              backdropFilter: 'blur(4px)',
              zIndex: 25,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <Activity size={32} className="text-indigo-400" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                AI가 골격 랜드마크를 검출하는 중...
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                관절 및 체형 기준선을 설정하고 있습니다.
              </div>
            </div>
          )}

          {/* Floating Zoom Toolbar overlay */}
          <div className="zoom-toolbar animate-fadeIn" style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            padding: '6px 14px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600' }}>배율: {Math.round(zoomScale * 100)}%</span>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1" 
              value={zoomScale} 
              onChange={(e) => setZoomScale(parseFloat(e.target.value))}
              style={{ width: '100px', accentColor: 'var(--color-local)', cursor: 'pointer' }}
            />
            <button 
              onClick={() => setZoomScale(1)}
              className="action-button"
              style={{ padding: '2px 8px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)' }}
            >
              100%
            </button>
          </div>

          {/* Posture Photo */}
          <div style={{ 
            position: 'relative', 
            maxWidth: '100%', 
            maxHeight: '100%',
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out'
          }}>
            <img 
              ref={imageRef}
              src={viewMode === 'side' ? sideImageSrc : frontImageSrc} 
              alt="자세 분석 모델"
              onLoad={updateDimensions}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '75vh',
                borderRadius: '8px',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />

            {/* Skeleton Bones Lines SVG Overlay */}
            <svg 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              {viewMode === 'side' ? (
                // SIDE VIEW SKELETON
                <>
                  {/* Ear - Shoulder (Cervical alignment) */}
                  <line 
                    x1={`${sideLandmarks.ear.x}%`} y1={`${sideLandmarks.ear.y}%`}
                    x2={`${sideLandmarks.shoulder.x}%`} y2={`${sideLandmarks.shoulder.y}%`}
                    stroke={diagnostics.sideMetrics[0].status === 'critical' ? '#ef4444' : diagnostics.sideMetrics[0].status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={3 / zoomScale}
                    strokeDasharray={`${4 / zoomScale} ${2 / zoomScale}`}
                  />
                  {/* Shoulder - Hip (Torso alignment) */}
                  <line 
                    x1={`${sideLandmarks.shoulder.x}%`} y1={`${sideLandmarks.shoulder.y}%`}
                    x2={`${(sideLandmarks.pelvisBack.x + sideLandmarks.pelvisFront.x)/2}%`} 
                    y2={`${(sideLandmarks.pelvisBack.y + sideLandmarks.pelvisFront.y)/2}%`}
                    stroke="#38bdf8"
                    strokeWidth={2.5 / zoomScale}
                  />
                  {/* Pelvis ASIS - PSIS line */}
                  <line 
                    x1={`${sideLandmarks.pelvisBack.x}%`} y1={`${sideLandmarks.pelvisBack.y}%`}
                    x2={`${sideLandmarks.pelvisFront.x}%`} y2={`${sideLandmarks.pelvisFront.y}%`}
                    stroke={diagnostics.sideMetrics[1].status === 'critical' ? '#ef4444' : diagnostics.sideMetrics[1].status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={4.5 / zoomScale}
                  />
                  {/* Hip - Knee */}
                  <line 
                    x1={`${(sideLandmarks.pelvisBack.x + sideLandmarks.pelvisFront.x)/2}%`} 
                    y1={`${(sideLandmarks.pelvisBack.y + sideLandmarks.pelvisFront.y)/2}%`}
                    x2={`${sideLandmarks.knee.x}%`} y2={`${sideLandmarks.knee.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2.5 / zoomScale}
                  />
                  {/* Knee - Ankle */}
                  <line 
                    x1={`${sideLandmarks.knee.x}%`} y1={`${sideLandmarks.knee.y}%`}
                    x2={`${sideLandmarks.ankle.x}%`} y2={`${sideLandmarks.ankle.y}%`}
                    stroke={diagnostics.sideMetrics[2].status === 'critical' ? '#ef4444' : diagnostics.sideMetrics[2].status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={2.5 / zoomScale}
                  />
                  {/* Vertical plumb line from shoulder down (Gravity Line Reference) */}
                  <line 
                    x1={`${sideLandmarks.shoulder.x}%`} y1={`${sideLandmarks.shoulder.y}%`}
                    x2={`${sideLandmarks.shoulder.x}%`} y2="95%"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1.5 / zoomScale}
                    strokeDasharray={`${5 / zoomScale} ${5 / zoomScale}`}
                  />
                </>
              ) : (
                // FRONT VIEW SKELETON
                <>
                  {/* Ear Left - Right */}
                  <line 
                    x1={`${frontLandmarks.leftEar.x}%`} y1={`${frontLandmarks.leftEar.y}%`}
                    x2={`${frontLandmarks.rightEar.x}%`} y2={`${frontLandmarks.rightEar.y}%`}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1.5 / zoomScale}
                  />
                  {/* Shoulder Left - Right */}
                  <line 
                    x1={`${frontLandmarks.leftShoulder.x}%`} y1={`${frontLandmarks.leftShoulder.y}%`}
                    x2={`${frontLandmarks.rightShoulder.x}%`} y2={`${frontLandmarks.rightShoulder.y}%`}
                    stroke={diagnostics.frontMetrics[0].status === 'critical' ? '#ef4444' : diagnostics.frontMetrics[0].status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={3.5 / zoomScale}
                  />
                  {/* Hip Left - Right */}
                  <line 
                    x1={`${frontLandmarks.leftHip.x}%`} y1={`${frontLandmarks.leftHip.y}%`}
                    x2={`${frontLandmarks.rightHip.x}%`} y2={`${frontLandmarks.rightHip.y}%`}
                    stroke={diagnostics.frontMetrics[1].status === 'critical' ? '#ef4444' : diagnostics.frontMetrics[1].status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth={3.5 / zoomScale}
                  />
                  {/* Spine connection (Mid Shoulder to Mid Hip) */}
                  <line 
                    x1={`${(frontLandmarks.leftShoulder.x + frontLandmarks.rightShoulder.x)/2}%`} 
                    y1={`${(frontLandmarks.leftShoulder.y + frontLandmarks.rightShoulder.y)/2}%`}
                    x2={`${(frontLandmarks.leftHip.x + frontLandmarks.rightHip.x)/2}%`} 
                    y2={`${(frontLandmarks.leftHip.y + frontLandmarks.rightHip.y)/2}%`}
                    stroke="#818cf8"
                    strokeWidth={2.5 / zoomScale}
                  />
                  {/* Left Leg (Hip - Knee - Ankle) */}
                  <line 
                    x1={`${frontLandmarks.leftHip.x}%`} y1={`${frontLandmarks.leftHip.y}%`}
                    x2={`${frontLandmarks.leftKnee.x}%`} y2={`${frontLandmarks.leftKnee.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2 / zoomScale}
                  />
                  <line 
                    x1={`${frontLandmarks.leftKnee.x}%`} y1={`${frontLandmarks.leftKnee.y}%`}
                    x2={`${frontLandmarks.leftAnkle.x}%`} y2={`${frontLandmarks.leftAnkle.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2 / zoomScale}
                  />
                  {/* Right Leg (Hip - Knee - Ankle) */}
                  <line 
                    x1={`${frontLandmarks.rightHip.x}%`} y1={`${frontLandmarks.rightHip.y}%`}
                    x2={`${frontLandmarks.rightKnee.x}%`} y2={`${frontLandmarks.rightKnee.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2 / zoomScale}
                  />
                  <line 
                    x1={`${frontLandmarks.rightKnee.x}%`} y1={`${frontLandmarks.rightKnee.y}%`}
                    x2={`${frontLandmarks.rightAnkle.x}%`} y2={`${frontLandmarks.rightAnkle.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2 / zoomScale}
                  />
                  {/* Center Alignment Reference Line */}
                  <line 
                    x1="50%" y1="5%"
                    x2="50%" y2="95%"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1.5 / zoomScale}
                    strokeDasharray={`${5 / zoomScale} ${5 / zoomScale}`}
                  />
                </>
              )}
            </svg>

            {/* Interactive Landmark Handles Overlay */}
            {viewMode === 'side' ? (
              Object.entries(sideLandmarks).map(([key, pt]) => (
                <div
                  key={key}
                  onMouseDown={() => handleMouseDown(key)}
                  onTouchStart={() => handleMouseDown(key)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  style={{
                    position: 'absolute',
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    transform: `translate(-50%, -50%) scale(${1 / zoomScale})`,
                    transformOrigin: 'center center',
                    cursor: 'grab',
                    zIndex: activePoint === key ? 100 : 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div className={`joint-handle-node ${activePoint === key ? 'dragging' : ''}`} style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: activePoint === key ? '#22d3ee' : 'var(--color-local)',
                    border: '2px solid #fff',
                    boxShadow: '0 0 10px rgba(99,102,241,0.8)',
                    transition: 'transform 0.15s ease, background-color 0.15s ease'
                  }}></div>
                  <span style={{
                    fontSize: '0.62rem',
                    color: '#f8fafc',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}>
                    {pt.label}
                  </span>
                </div>
              ))
            ) : (
              Object.entries(frontLandmarks).map(([key, pt]) => (
                <div
                  key={key}
                  onMouseDown={() => handleMouseDown(key)}
                  onTouchStart={() => handleMouseDown(key)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  style={{
                    position: 'absolute',
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    transform: `translate(-50%, -50%) scale(${1 / zoomScale})`,
                    transformOrigin: 'center center',
                    cursor: 'grab',
                    zIndex: activePoint === key ? 100 : 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div className={`joint-handle-node ${activePoint === key ? 'dragging' : ''}`} style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: activePoint === key ? '#22d3ee' : 'var(--color-local)',
                    border: '2px solid #fff',
                    boxShadow: '0 0 10px rgba(99,102,241,0.8)',
                    transition: 'transform 0.15s ease, background-color 0.15s ease'
                  }}></div>
                  <span style={{
                    fontSize: '0.62rem',
                    color: '#f8fafc',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}>
                    {pt.label}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Diagnostic Output & Result Application */}
        <div className="diagnostics-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-primary)',
          borderRadius: '12px',
          padding: '20px',
          height: '100%',
          overflowY: 'auto'
        }}>
          
          <h2 style={{
            fontSize: '1rem', 
            fontWeight: '700', 
            color: 'var(--text-primary)', 
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-primary)',
            paddingBottom: '12px'
          }}>
            <Activity className="text-cyan-400" size={18} />
            실시간 생체역학 진단 리포트
          </h2>

          {/* Metric list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, paddingRight: '4px' }}>
            
            {/* SIDE METRICS SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div 
                onClick={() => setViewMode('side')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: viewMode === 'side' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: '1px solid ' + (viewMode === 'side' ? 'rgba(99, 102, 241, 0.2)' : 'transparent'),
                  transition: 'all 0.2s ease'
                }}
              >
                <h3 style={{ fontSize: '0.8rem', fontWeight: '700', color: viewMode === 'side' ? '#a5b4fc' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#818cf8' }}></span>
                  측면 체형 분석 지표 (Side Profile)
                </h3>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{viewMode === 'side' ? '편집 중' : '클릭하여 편집'}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: viewMode === 'side' ? 1 : 0.75 }}>
                {diagnostics.sideMetrics.map((metric, idx) => (
                  <div 
                    key={idx} 
                    className={`diagnostic-card status-${metric.status}`} 
                    style={{
                      background: viewMode === 'side' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(30, 41, 59, 0.2)',
                      border: '1px solid ' + (
                        metric.status === 'critical' ? 'rgba(239, 68, 68, 0.4)' : 
                        metric.status === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-primary)'
                      ),
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: viewMode === 'side' && metric.status !== 'normal' ? '0 0 12px rgba(245, 158, 11, 0.05)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{metric.name}</span>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: '700', 
                        color: metric.status === 'critical' ? '#ef4444' : metric.status === 'warning' ? '#f59e0b' : '#10b981'
                      }}>
                        {metric.value}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {metric.status !== 'normal' ? (
                        <AlertTriangle size={11} style={{ color: metric.status === 'critical' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                      ) : (
                        <Check size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: '500' }}>{metric.desc}</span>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.35', margin: 0 }}>
                      {metric.guide}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* FRONT METRICS SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <div 
                onClick={() => setViewMode('front')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: viewMode === 'front' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: '1px solid ' + (viewMode === 'front' ? 'rgba(99, 102, 241, 0.2)' : 'transparent'),
                  transition: 'all 0.2s ease'
                }}
              >
                <h3 style={{ fontSize: '0.8rem', fontWeight: '700', color: viewMode === 'front' ? '#a5b4fc' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }}></span>
                  전면 체형 분석 지표 (Frontal Profile)
                </h3>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{viewMode === 'front' ? '편집 중' : '클릭하여 편집'}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: viewMode === 'front' ? 1 : 0.75 }}>
                {diagnostics.frontMetrics.map((metric, idx) => (
                  <div 
                    key={idx} 
                    className={`diagnostic-card status-${metric.status}`} 
                    style={{
                      background: viewMode === 'front' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(30, 41, 59, 0.2)',
                      border: '1px solid ' + (
                        metric.status === 'critical' ? 'rgba(239, 68, 68, 0.4)' : 
                        metric.status === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-primary)'
                      ),
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: viewMode === 'front' && metric.status !== 'normal' ? '0 0 12px rgba(245, 158, 11, 0.05)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{metric.name}</span>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: '700', 
                        color: metric.status === 'critical' ? '#ef4444' : metric.status === 'warning' ? '#f59e0b' : '#10b981'
                      }}>
                        {metric.value}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {metric.status !== 'normal' ? (
                        <AlertTriangle size={11} style={{ color: metric.status === 'critical' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                      ) : (
                        <Check size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: '500' }}>{metric.desc}</span>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.35', margin: 0 }}>
                      {metric.guide}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Suspected Compensations / Nodes list */}
            <div style={{ 
              marginTop: '10px', 
              paddingTop: '16px', 
              borderTop: '1px solid var(--border-primary)' 
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={13} className="text-yellow-400" />
                감지된 연쇄 보상 패턴 노드 ({diagnostics.suspectedNodes.length})
              </h3>
              
              {diagnostics.suspectedNodes.length === 0 ? (
                <div style={{ 
                  fontSize: '0.72rem', 
                  color: 'var(--text-muted)', 
                  padding: '12px', 
                  textAlign: 'center', 
                  background: 'rgba(30, 41, 59, 0.2)', 
                  borderRadius: '6px',
                  border: '1px dashed var(--border-primary)'
                }}>
                  감지된 체형 불균형이 없습니다. 관절점을 조정해 보세요.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {diagnostics.suspectedNodes.map((nodeId) => (
                    <span 
                      key={nodeId}
                      onClick={() => onSelectNode && onSelectNode(nodeId)}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: '500',
                        color: '#a5b4fc',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                      }}
                      title="맵에서 이 노드의 문서 미리보기"
                    >
                      {nodeId}
                      <Info size={10} style={{ opacity: 0.7 }} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
            <button
              onClick={handleApply}
              disabled={diagnostics.suspectedNodes.length === 0}
              className="action-button save"
              style={{
                width: '100%',
                height: '42px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                borderRadius: '8px',
                cursor: diagnostics.suspectedNodes.length === 0 ? 'not-allowed' : 'pointer',
                opacity: diagnostics.suspectedNodes.length === 0 ? 0.5 : 1,
                boxShadow: diagnostics.suspectedNodes.length > 0 ? '0 4px 14px rgba(6, 182, 212, 0.25)' : 'none'
              }}
            >
              분석 결과 맵에 반영하기
              <ArrowRight size={16} />
            </button>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', lineHeight: '1.3' }}>
              * 맵에 반영하면 분석실 탭을 종료하고 그래프 캔버스로 돌아가 불균형 노드 및 활성화된 경로를 시각적으로 추적합니다.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default PostureAnalyzer;
