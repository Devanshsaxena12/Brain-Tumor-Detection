import React, { useState, useRef, Suspense } from 'react';
import { 
  Upload, 
  Activity, 
  FileText, 
  Brain, 
  Download,
  SplitSquareHorizontal,
  Maximize2,
  Minimize2,
  X,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  BarChart3,
  Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { View, Preload } from '@react-three/drei';
import BrainModel from './BrainModel';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [result, setResult] = useState(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  
  // Interactive Mechanics State
  const [activeMode, setActiveMode] = useState('gradcam');
  const [sliderValue, setSliderValue] = useState(1.0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const constraintsRef = useRef(null);
  const [isSpatialExpanded, setIsSpatialExpanded] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  
  // Prediction Panel State
  const [isPredictionOpen, setIsPredictionOpen] = useState(false);

  // ==========================================
  // RISK LEVEL HELPERS
  // ==========================================
  const getRiskColor = (score) => {
    if (score >= 75) return '#ff3366';
    if (score >= 50) return '#ffb400';
    if (score >= 25) return '#00f2ff';
    return '#00ff9d';
  };

  const getRiskLabel = (score) => {
    if (score >= 75) return 'HIGH RISK';
    if (score >= 50) return 'MODERATE RISK';
    if (score >= 25) return 'LOW RISK';
    return 'MINIMAL';
  };

  const getDiagnosisColor = (label) => {
    if (label === 'No Tumor') return '#00ff9d';
    if (label === 'Glioma') return '#ff3366';
    if (label === 'Meningioma') return '#ff6633';
    return '#ffb400'; // Pituitary
  };

  // ==========================================
  // PREDICTION ANALYSIS PANEL
  // ==========================================
  const PredictionPanel = () => {
    if (!result) return null;
    const rm = result.risk_metrics || {};
    const hasTumor = result.label !== 'No Tumor';
    const riskScore = rm.risk_score || 0;
    const riskColor = getRiskColor(riskScore);

    // Sort probabilities highest first
    const sortedProbs = Object.entries(result.probabilities || {})
      .sort((a, b) => b[1] - a[1]);

    return (
      <AnimatePresence>
        {isPredictionOpen && (
          <motion.div 
            className="prediction-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="prediction-panel"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Panel Header */}
              <div className="pred-header">
                <div className="pred-header-left">
                  <Scan size={20} className="accent-cyan" />
                  <div>
                    <h2 className="pred-header-title">TUMOR PREDICTION ANALYSIS</h2>
                    <p className="pred-header-sub">AI-Powered Clinical Assessment</p>
                  </div>
                </div>
                <button className="pred-close-btn" onClick={() => setIsPredictionOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Panel Body */}
              <div className="pred-body">
                
                {/* PRIMARY DIAGNOSIS CARD */}
                <div className="pred-card pred-diagnosis-card">
                  <div className="pred-card-header">
                    <span className="pred-card-label">PRIMARY DIAGNOSIS</span>
                    <div className={`pred-status-badge ${hasTumor ? 'danger' : 'safe'}`}>
                      {hasTumor ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                      {hasTumor ? 'TUMOR DETECTED' : 'CLEAR'}
                    </div>
                  </div>
                  <div className="pred-diagnosis-row">
                    <span 
                      className="pred-diagnosis-label"
                      style={{ color: getDiagnosisColor(result.label) }}
                    >
                      {result.label}
                    </span>
                    <span className="pred-confidence-value">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="pred-confidence-bar-track">
                    <motion.div 
                      className="pred-confidence-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                      style={{ background: getDiagnosisColor(result.label) }}
                    />
                  </div>
                </div>

                {/* PROBABILITY DISTRIBUTION */}
                <div className="pred-card">
                  <div className="pred-card-header">
                    <span className="pred-card-label">CLASSIFICATION PROBABILITIES</span>
                    <BarChart3 size={14} className="pred-card-icon" />
                  </div>
                  <div className="pred-prob-list">
                    {sortedProbs.map(([cls, prob], idx) => (
                      <div className="pred-prob-row" key={cls}>
                        <div className="pred-prob-info">
                          <span className={`pred-prob-rank ${idx === 0 ? 'top' : ''}`}>
                            {idx === 0 ? '▸' : ' '}
                          </span>
                          <span className="pred-prob-cls">{cls}</span>
                        </div>
                        <div className="pred-prob-bar-track">
                          <motion.div 
                            className="pred-prob-bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${prob * 100}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + idx * 0.1 }}
                            style={{ 
                              background: idx === 0 ? getDiagnosisColor(cls) : 'rgba(255,255,255,0.15)',
                              boxShadow: idx === 0 ? `0 0 12px ${getDiagnosisColor(cls)}40` : 'none'
                            }}
                          />
                        </div>
                        <span className={`pred-prob-pct ${idx === 0 ? 'top' : ''}`}>
                          {(prob * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RISK METRICS (only if tumor detected) */}
                {hasTumor && rm.risk_score !== undefined && (
                  <div className="pred-card pred-risk-card">
                    <div className="pred-card-header">
                      <span className="pred-card-label">CLINICAL RISK ASSESSMENT</span>
                      <TrendingUp size={14} className="pred-card-icon" />
                    </div>
                    
                    <div className="pred-risk-grid">
                      {/* Risk Score Gauge */}
                      <div className="pred-risk-gauge-block">
                        <div 
                          className="pred-risk-gauge"
                          style={{ 
                            '--risk-pct': `${riskScore}%`,
                            '--risk-color': riskColor
                          }}
                        >
                          <div className="pred-risk-gauge-inner">
                            <span className="pred-risk-score">{riskScore}</span>
                            <span className="pred-risk-max">/100</span>
                          </div>
                        </div>
                        <span className="pred-risk-level" style={{ color: riskColor }}>
                          {getRiskLabel(riskScore)}
                        </span>
                      </div>

                      {/* Risk Metrics */}
                      <div className="pred-risk-metrics">
                        <div className="pred-risk-metric">
                          <span className="pred-risk-metric-label">IRREGULARITY</span>
                          <div className="pred-risk-metric-bar-track">
                            <motion.div 
                              className="pred-risk-metric-bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${(rm.irregularity_ratio || 0) * 100}%` }}
                              transition={{ duration: 0.8, delay: 0.5 }}
                              style={{ background: (rm.irregularity_ratio || 0) > 0.5 ? '#ff3366' : '#00f2ff' }}
                            />
                          </div>
                          <span className="pred-risk-metric-val">{(rm.irregularity_ratio || 0).toFixed(2)}</span>
                        </div>
                        <div className="pred-risk-metric">
                          <span className="pred-risk-metric-label">ACTIVATION AREA</span>
                          <div className="pred-risk-metric-bar-track">
                            <motion.div 
                              className="pred-risk-metric-bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((rm.activation_area || 0) * 100 * 3, 100)}%` }}
                              transition={{ duration: 0.8, delay: 0.6 }}
                              style={{ background: '#ffb400' }}
                            />
                          </div>
                          <span className="pred-risk-metric-val">{((rm.activation_area || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="pred-risk-metric">
                          <span className="pred-risk-metric-label">ENTROPY</span>
                          <div className="pred-risk-metric-bar-track">
                            <motion.div 
                              className="pred-risk-metric-bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(((rm.entropy || 0) / 12) * 100, 100)}%` }}
                              transition={{ duration: 0.8, delay: 0.7 }}
                              style={{ background: '#a855f7' }}
                            />
                          </div>
                          <span className="pred-risk-metric-val">{(rm.entropy || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Layman's Explainer */}
                    <div className="pred-risk-explainer">
                      <div className="exp-item">
                        <span className="exp-label">IRREGULARITY:</span> High values mean the tumor has scattered, uneven borders (often more severe).
                      </div>
                      <div className="exp-item">
                        <span className="exp-label">AREA:</span> Indicates how much of the brain scan the active tumor region occupies.
                      </div>
                      <div className="exp-item">
                        <span className="exp-label">ENTROPY:</span> Measures visual chaos. Higher entropy implies complex, aggressive tissue growth.
                      </div>
                    </div>
                  </div>
                )}

                {/* BIOMISTRAL AI NARRATIVE */}
                {result.clinical_narrative && (
                  <div className="pred-card pred-narrative-card">
                    <div className="pred-card-header">
                      <span className="pred-card-label">AI CLINICAL NARRATIVE</span>
                      <div className="pred-bio-badge">
                        <Brain size={10} />
                        BioMistral-7B
                      </div>
                    </div>
                    <div className="pred-narrative-body">
                      {result.clinical_narrative.split('\n').filter(l => l.trim()).map((paragraph, idx) => (
                        <p key={idx} className="pred-narrative-p">{paragraph.trim()}</p>
                      ))}
                    </div>
                    <div className="pred-narrative-disclaimer">
                      <AlertTriangle size={12} />
                      AI-generated interpretation for clinical decision support only. Must be validated by a qualified radiologist.
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // ==========================================
  // TARGET CROSSHAIR HUD
  // ==========================================
  const TargetHUD = ({ location }) => {
    if (!location) return null;
    return (
      <motion.div 
        className="clinical-target-crosshair"
        initial={{ opacity: 0, scale: 2 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          left: `${location.x * 100}%`,
          top: `${location.y * 100}%`
        }}
      >
        <div className="crosshair-ring" />
        <div className="crosshair-id">TRGT-01</div>
      </motion.div>
    );
  };

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setResult(null);
      setZoomLevel(1.0);
      setIsPredictionOpen(false);
    }
  };

  const analyzeMRI = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setScanStatus("INITIALIZING NEURAL CORE...");
    const formData = new FormData();
    formData.append('file', file);

    try {
      setTimeout(() => setScanStatus("EXTRACTING FEATURES VIA RESNET-50..."), 800);
      setTimeout(() => setScanStatus("GENERATING GRAD-CAM HEATMAP..."), 1600);
      setTimeout(() => setScanStatus("RUNNING BIOMISTRAL RISK ANALYSIS..."), 2200);

      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis engine failed");

      const data = await response.json();
      
      setTimeout(() => {
        setResult(data);
        setActiveMode('gradcam');
        setSliderValue(1.0);
        setZoomLevel(1.0);
        setIsAnalyzing(false);
        // Auto-open prediction panel when results arrive
        setIsPredictionOpen(true);
      }, 2800); 
    } catch (error) {
      console.error(error);
      alert("AI Core Analysis Failed. Please check backend status.");
      setIsAnalyzing(false);
    }
  };

  const generateReport = async () => {
    if (!result) return;
    setIsExporting(true);

    try {
      const response = await fetch(`${API_BASE}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });

      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch (error) {
      console.error(error);
      alert("PDF Generation failed. Check backend logs.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfPreviewUrl) return;
    const a = document.createElement('a');
    a.href = pdfPreviewUrl;
    a.download = `Neural_Nexus_Report.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const closePreview = () => {
    setPdfPreviewUrl(null);
  };

  const handleWheel = (e) => {
    if (!result) return;
    const zoomDelta = e.deltaY * -0.001;
    setZoomLevel(prev => Math.min(Math.max(1.0, prev + zoomDelta), 5.0));
  };

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    if (mode === 'split') {
      setSliderValue(0.5);
    } else if (mode === 'gradcam') {
      setSliderValue(1.0);
    }
  };

  const spatialMapVariants = {
    docked: {
      bottom: "2rem", left: "2rem", top: "auto", right: "auto",
      width: "280px", height: "280px",
      x: "0%", y: "0%", zIndex: 50, opacity: 1, scale: 1,
    },
    global: {
      top: "50%", left: "50%", bottom: "auto", right: "auto",
      width: "100vw", height: "100vh",
      x: "-50%", y: "-50%", zIndex: 100, opacity: 1, scale: 1,
    },
    expanded: {
      top: "50%", left: "50%", bottom: "auto", right: "auto",
      width: "80vw", height: "80vh",
      x: "-50%", y: "-50%", zIndex: 100, opacity: 1, scale: 1,
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="viewport-root">
      
      {/* BACKGROUND / MAIN CONTENT MANAGER */}
      {result ? (
        <div 
          className="mri-cinematic-display mri-interactive-viewport fullscreen"
          ref={constraintsRef}
          onWheel={handleWheel}
        >
          <motion.div
            className="mri-layer-group"
            drag={zoomLevel > 1.0}
            dragConstraints={constraintsRef}
            animate={{ scale: zoomLevel }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
          >
            <img 
              src={`data:image/png;base64,${result.images[activeMode === 'enhanced' ? 'enhanced' : 'original']}`} 
              className="mri-layer base-layer" 
              alt="Base Scan" 
              draggable="false"
            />
            
            {activeMode === 'split' ? (
               <>
                  <img 
                    src={`data:image/png;base64,${result.images.heatmap}`} 
                    className="mri-layer heatmap-layer" 
                    alt="Heatmap Split Layer"
                    draggable="false"
                    style={{ 
                       clipPath: `inset(0 0 0 ${sliderValue * 100}%)`,
                       opacity: 1 
                    }}
                  />
                  <div 
                    className="split-wipe-handle" 
                    style={{ left: `${sliderValue * 100}%` }}
                  />
               </>
            ) : (
               <img 
                 src={`data:image/png;base64,${result.images.heatmap}`} 
                 className="mri-layer heatmap-layer" 
                 alt="Heatmap Opacity Layer"
                 draggable="false"
                 style={{ opacity: activeMode === 'gradcam' ? sliderValue : 0 }}
               />
            )}
            
            <TargetHUD location={selectedHotspot} />
          </motion.div>
        </div>
      ) : (
        /* ZERO-STATE DROPZONE */
        <div className="zero-state-dropzone">
          <input 
            type="file" 
            id="mri-upload" 
            accept="image/*" 
            onChange={handleFileUpload}
            hidden 
          />
          <label htmlFor="mri-upload" className="dropzone-area">
            {file ? (
              <div className="dropzone-content">
                <FileText size={48} className="accent-cyan" />
                <h2 className="dropzone-title">{file.name}</h2>
                <p className="dropzone-subtitle">Ready for analysis</p>
                <button 
                  className="workflow-btn glow float-btn"
                  onClick={(e) => { e.preventDefault(); analyzeMRI(); }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? <Activity size={18} className="spin" /> : <Brain size={18} />}
                  {isAnalyzing ? 'PROCESSING...' : 'INITIATE INFERENCE'}
                </button>
              </div>
            ) : (
              <div className="dropzone-content">
                <Brain size={64} className="accent-cyan" style={{ opacity: 0.8 }} />
                <h2 className="dropzone-title">AWAITING INPUT</h2>
                <p className="dropzone-subtitle mt-2">Click or drag DICOM, JPG, PNG here</p>
              </div>
            )}
          </label>
        </div>
      )}

      {/* FLOATING TOP LEFT - BRAND & TELEMETRY */}
      <div className="hud-module top-left">
        <div className="brand-header minimal">
          <Brain size={24} className="accent-cyan" />
          <div className="brand-text">
            <h1>NEURAL NEXUS</h1>
            <p>Clinical Diagnostics HUD</p>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div 
              className="telemetry-minimal"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="metric-row">
                <span className="metric-label">DIAGNOSIS</span>
                <span className="metric-value" style={{ color: getDiagnosisColor(result.label) }}>
                  {result.label !== 'No Tumor' ? result.label.toUpperCase() + ' DETECTED' : 'NO TUMOR'}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">CONFIDENCE</span>
                <span className="metric-value accent-cyan">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              {result.risk_metrics && result.label !== 'No Tumor' && (
                <div className="metric-row">
                  <span className="metric-label">RISK SCORE</span>
                  <span className="metric-value" style={{ color: getRiskColor(result.risk_metrics.risk_score) }}>
                    {result.risk_metrics.risk_score}/100
                  </span>
                </div>
              )}
              <div className="metric-row">
                <span className="metric-label">ZOOM STATE</span>
                <span className="metric-value">{zoomLevel.toFixed(1)}x</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3D SPATIAL COPILOT */}
      <AnimatePresence>
        {(isAnalyzing || result) && (
          <motion.div 
            layout
            className="spatial-canvas-wrapper"
            variants={spatialMapVariants}
            initial="docked"
            animate={isAnalyzing ? "global" : (isSpatialExpanded ? "expanded" : "docked")}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {!isAnalyzing && (
              <div className="copilot-header">
                 <Brain size={12} className="accent-cyan" /> 
                 <span>SPATIAL MAP</span>
                 <button 
                   className="expand-btn"
                   onClick={(e) => {
                     e.stopPropagation();
                     setIsSpatialExpanded(!isSpatialExpanded);
                   }}
                   title={isSpatialExpanded ? "Minimize" : "Expand"}
                 >
                   {isSpatialExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                 </button>
              </div>
            )}
            <div className="canvas-container-placeholder" ref={constraintsRef}>
              <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <Suspense fallback={null}>
                  <BrainModel 
                    diagnosis={result?.label} 
                    tumorLocation={result?.tumor_location}
                    onHotspotClick={(loc) => setSelectedHotspot(loc)}
                    phase={!isAnalyzing ? 'docked' : (scanStatus.includes('INITIALIZING') ? 'dispersed' : 'forming')}
                    isSpatialExpanded={isSpatialExpanded}
                  />
                </Suspense>
                <Preload all />
              </Canvas>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING TOP RIGHT - ACTIONS */}
      <AnimatePresence>
        {result && (
          <motion.div 
            className="hud-module top-right"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="top-right-actions">
              <button 
                className="hud-action-btn prediction-btn"
                onClick={() => setIsPredictionOpen(true)}
                title="View Tumor Prediction Analysis"
              >
                <Scan size={16} /> 
                PREDICTION
                {result.label !== 'No Tumor' && (
                  <span className="pred-badge-dot" />
                )}
              </button>
              <button className="hud-action-btn" onClick={generateReport} disabled={isExporting}>
                 <FileText size={16} /> 
                 {isExporting ? 'GENERATING...' : 'EXPORT REPORT'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BOTTOM CENTER - MODES & ADJUSTER */}
      <AnimatePresence>
        {result && (
          <motion.div 
            className="hud-module bottom-center cinematic-hud"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="hud-pill-menu" style={{ maxWidth: '440px' }}>
              <button 
                className={activeMode === 'raw' ? 'active' : ''} 
                onClick={() => handleModeChange('raw')}
              >
                RAW
              </button>
              <button 
                className={activeMode === 'enhanced' ? 'active' : ''} 
                onClick={() => handleModeChange('enhanced')}
              >
                ENHANCED
              </button>
              <button 
                className={activeMode === 'split' ? 'active' : ''} 
                onClick={() => handleModeChange('split')}
              >
                SPLIT-VIEW
              </button>
              <button 
                className={activeMode === 'gradcam' ? 'active' : ''} 
                onClick={() => handleModeChange('gradcam')}
              >
                GRAD-CAM
              </button>
            </div>

            <AnimatePresence>
              {(activeMode === 'gradcam' || activeMode === 'split') && (
                <motion.div 
                  className="hud-adjuster"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0.5rem 0' }}>
                    <div className="adjuster-header">
                      <span className="adjuster-label">
                        {activeMode === 'split' ? 'WIPE BOUNDARY' : 'HEATMAP INTENSITY'}
                      </span>
                      <span className="adjuster-value">{Math.round(sliderValue * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      className="styled-slider" 
                      min="0" max="1" step="0.01" 
                      value={sliderValue} 
                      onChange={(e) => setSliderValue(parseFloat(e.target.value))}
                      style={{ marginTop: '0.5rem' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREDICTION ANALYSIS PANEL */}
      <PredictionPanel />

      {/* OVERLAYS (Pulse Scan & PDF) */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            className="scan-overlay fullscreen-override"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="pulse-grid"></div>
            <div className="scan-line"></div>
            <div className="scan-status-container">
              <Activity size={32} className="spin accent-cyan" />
              <h2>{scanStatus}</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pdfPreviewUrl && (
          <motion.div 
            className="preview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="preview-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="preview-header">
                <div className="preview-title">
                  <FileText size={18} className="accent-cyan-text" />
                  CLINICAL REPORT PREVIEW
                </div>
                <div className="preview-actions">
                  <button className="action-btn close" onClick={closePreview}>
                    CANCEL
                  </button>
                  <button className="action-btn download" onClick={downloadPDF}>
                    <Download size={14} /> DOWNLOAD DOCUMENT
                  </button>
                </div>
              </div>
              <iframe src={pdfPreviewUrl} className="preview-iframe" title="PDF Preview" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
