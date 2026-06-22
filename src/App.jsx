import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import dagre from 'dagre';
import { Search, Brain, Folder, Network, HelpCircle, LayoutGrid, Edit3, Save, X, Sliders, Trash2, Camera, Sparkles } from 'lucide-react';
import CustomNode from './CustomNode';
import PostureAnalyzer from './PostureAnalyzer';
import graphData from '../data.json';

// Import Anatomical Illustrations
import turtleNeckImg from './assets/거북목.png';
import tmjImg from './assets/턱관절_장애.png';
import headacheImg from './assets/두통_및_신경통.png';
import pelvicTiltImg from './assets/골반_전방경사.png';
import lateralPelvicImg from './assets/골반_측방경사.png';
import qlTensionImg from './assets/요방형근_비대칭_긴장.png';
import anklePronationImg from './assets/발목_과회내.png';
import dorsiflexionImg from './assets/발목_배측굴곡제한.png';
import plantarFlexionTightnessImg from './assets/발목_저측굴곡근단축.png';
import thoracicShoulderImg from './assets/어깨_흉추.png';
import thoracicRotationLimitImg from './assets/흉추_회전_제한.png';
import scapularDepressionImg from './assets/견갑골_하강.png';
import kneeBackImg from './assets/무릎_백니.png';
import myofascialImg from './assets/근막선.png';

// Import New Detailed Anatomical Illustrations
import pelvicRotationImg from './assets/골반_회전_비대칭.png';
import cervicalRotationImg from './assets/경추_회전_보상.png';
import qlShoulderImbalanceImg from './assets/요방형근_어깨_불균형.png';

// Import CSS
import '@xyflow/react/dist/style.css';
import './index.css';

// Node type mapping
const nodeTypes = {
  custom: CustomNode,
};

// Map each of the 22 nodes to their specific anatomical diagrams
const nodeImages = {
  // Head & Neck / Jaw
  '거북목(전방머리자세)': turtleNeckImg,
  '턱관절_기능장애': tmjImg,
  '두통_및_신경통': headacheImg,
  '경추_회전_보상패턴': cervicalRotationImg,

  // Shoulder & Thoracic
  '견갑골_하강_및_하방회전': scapularDepressionImg,
  '흉추_회전_가동성_제한': thoracicRotationLimitImg,
  '요방형근과 어깨 불균형': qlShoulderImbalanceImg,

  // Pelvis & Core
  '골반 전방경사 패턴': pelvicTiltImg,
  '골반_전방경사 패턴': pelvicTiltImg,
  '골반_측방경사': lateralPelvicImg,
  '골반_회전_비대칭': pelvicRotationImg,
  '요방형근_비대칭_긴장': qlTensionImg,

  // Knee & Leg Compensation
  '백니와 무릎의 보상': kneeBackImg,
  '불안정성': anklePronationImg, // Mapped to ankle diagram (previously kneeBackImg)

  // Ankle & Foot
  '01. Triggers': anklePronationImg,
  '발목': anklePronationImg,
  '발목_과회내(평발)': anklePronationImg,
  '발목_배측굴곡제한': dorsiflexionImg,
  '발목_안정성부족(고유수용감각저하)': anklePronationImg,
  '발목_저측굴곡근단축(까치발)': plantarFlexionTightnessImg,

  // Myofascial Slings
  '교차_기능선_보상': myofascialImg,
  '교차_나선선_보상': myofascialImg,
};

// Dagre Layout function
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  
  // Configure Dagre spacing
  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranker: 'network-simplex', 
    nodesep: 60, 
    ranksep: 100 
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 260, height: 110 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - 130, // offset half width
        y: nodeWithPosition.y - 55,  // offset half height
      },
    };
  });
};

function GraphApp() {
  const { fitView } = useReactFlow();
  
  // Tab control: 'map' or 'analyzer'
  const [activeTab, setActiveTab] = useState('map');
  
  // AI Posture analysis results
  const [analyzerResults, setAnalyzerResults] = useState([]);
  
  // Graph reactive state
  const [currentGraphData, setCurrentGraphData] = useState(graphData);
  
  // Layout direction state: 'TB' (Top-to-Bottom) or 'LR' (Left-to-Right)
  const [direction, setDirection] = useState('TB');
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Node state
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Lightbox Modal states
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  // Responsiveness states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isLeftOpen, setIsLeftOpen] = useState(window.innerWidth > 1024);
  const [isRightOpen, setIsRightOpen] = useState(window.innerWidth > 1024);

  // Track window resizing for responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync sidebar open states when viewport scale changes
  useEffect(() => {
    if (isMobile) {
      setIsLeftOpen(false);
      setIsRightOpen(false);
    } else {
      setIsLeftOpen(true);
      setIsRightOpen(true);
    }
  }, [isMobile]);

  // Map initial nodes and edges from currentGraphData
  const initialNodes = useMemo(() => {
    return currentGraphData.nodes.map((node) => ({
      id: node.id,
      type: 'custom',
      data: {
        label: node.label,
        group: node.group,
        summary: node.summary,
        content: node.content,
        exists: node.exists,
        isAnalyzerDetected: analyzerResults.includes(node.id),
      },
      position: { x: 0, y: 0 },
    }));
  }, [currentGraphData, analyzerResults]);

  const initialEdges = useMemo(() => {
    return currentGraphData.edges.map((edge, idx) => ({
      id: `edge-${idx}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'rgba(99, 102, 241, 0.45)', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
        width: 15,
        height: 15,
      },
    }));
  }, [currentGraphData]);

  // React Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Perform layouting when direction or graph data updates
  useEffect(() => {
    const layouted = getLayoutedElements(initialNodes, initialEdges, direction);
    setNodes(layouted);
    setEdges(initialEdges);
    
    // Fit view after a tiny delay to ensure nodes are mounted
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 800 });
    }, 100);
  }, [direction, initialNodes, initialEdges, setNodes, setEdges, fitView]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Highlight nodes matching search
  const filteredNodesList = useMemo(() => {
    return currentGraphData.nodes.filter(
      (node) =>
        node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.summary && node.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, currentGraphData]);

  // Modify nodes and edges dynamically to highlight search, selection, and connection focus mode
  useEffect(() => {
    // Determine focus mode
    const isFocusMode = selectedNodeId !== null || analyzerResults.length > 0;

    // Determine nodes to display/keep visible
    const visibleNodeIds = new Set();
    const connectedNodeIds = new Set(); // strictly neighbors of selected node

    if (selectedNodeId) {
      visibleNodeIds.add(selectedNodeId);
      connectedNodeIds.add(selectedNodeId);
      initialEdges.forEach((edge) => {
        if (edge.source === selectedNodeId) {
          visibleNodeIds.add(edge.target);
          connectedNodeIds.add(edge.target);
        } else if (edge.target === selectedNodeId) {
          visibleNodeIds.add(edge.source);
          connectedNodeIds.add(edge.source);
        }
      });
    }

    if (analyzerResults.length > 0) {
      analyzerResults.forEach((id) => {
        visibleNodeIds.add(id);
        // Also keep direct neighbors of analyzer results visible
        initialEdges.forEach((edge) => {
          if (edge.source === id) visibleNodeIds.add(edge.target);
          else if (edge.target === id) visibleNodeIds.add(edge.source);
        });
      });
    }

    setNodes((nds) =>
      nds.map((node) => {
        const matchesSearch =
          searchQuery &&
          (node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (node.data.summary && node.data.summary.toLowerCase().includes(searchQuery.toLowerCase())));

        const isConnected = isFocusMode ? visibleNodeIds.has(node.id) : true;
        const isAnalyzerDetected = analyzerResults.includes(node.id);
        
        let opacity = 1;
        if (isFocusMode && !isConnected) {
          opacity = 0.12; // Dim heavily to create contrast
        }

        // Determine if this neighbor is inbound or outbound relative to selected node
        const isInbound = selectedNodeId && connectedNodeIds.has(node.id) && initialEdges.some(e => e.source === node.id && e.target === selectedNodeId);
        const isOutbound = selectedNodeId && connectedNodeIds.has(node.id) && initialEdges.some(e => e.target === node.id && e.source === selectedNodeId);

        let borderStyle = {};
        if (matchesSearch) {
          borderStyle = { border: '3px solid #818cf8', boxShadow: '0 0 20px rgba(129, 140, 248, 0.8)' };
        } else if (node.id === selectedNodeId) {
          // Selected node glows in main theme color
          borderStyle = { border: '3px solid #6366f1', boxShadow: '0 0 24px rgba(99, 102, 241, 0.9), inset 0 0 10px rgba(99, 102, 241, 0.3)' };
        } else if (isAnalyzerDetected) {
          // Analyzer-detected node glows in cyber cyan
          borderStyle = { border: '3.5px solid #22d3ee', boxShadow: '0 0 24px rgba(34, 211, 238, 0.95), inset 0 0 10px rgba(34, 211, 238, 0.3)' };
        } else if (selectedNodeId && (isInbound || isOutbound)) {
          // Connected neighbors of selected node glow in theme indigo
          borderStyle = { border: '3px solid #818cf8', boxShadow: '0 0 18px rgba(129, 140, 248, 0.8)' };
        } else if (analyzerResults.length > 0 && isConnected) {
          // Connected neighbors of analyzer results glow in soft cyan
          borderStyle = { border: '1.5px solid rgba(34, 211, 238, 0.55)', boxShadow: '0 0 12px rgba(34, 211, 238, 0.3)' };
        }

        return {
          ...node,
          selected: node.id === selectedNodeId,
          style: {
            ...borderStyle,
            opacity,
            transition: 'opacity 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
          },
        };
      })
    );

    setEdges(() =>
      initialEdges.map((edge) => {
        if (isFocusMode) {
          const isHighlighted = selectedNodeId && connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target);
          const isAnalyzerEdge = analyzerResults.includes(edge.source) && analyzerResults.includes(edge.target);
          const connectsToAnalyzer = analyzerResults.includes(edge.source) || analyzerResults.includes(edge.target);

          let stroke = 'rgba(99, 102, 241, 0.015)'; // Dimmed
          let strokeWidth = 0.5;
          let filter = 'none';
          let markerColor = 'rgba(99, 102, 241, 0.005)';
          let markerSize = 0;
          let animated = false;

          if (isAnalyzerEdge) {
            stroke = '#22d3ee'; // Cyber cyan
            strokeWidth = 7.0;   // Thick pipeline
            filter = 'drop-shadow(0px 0px 9px rgba(34, 211, 238, 0.95))';
            markerColor = '#22d3ee';
            markerSize = 24;
            animated = true;
          } else if (isHighlighted) {
            stroke = '#a78bfa'; // Violet
            strokeWidth = 6.5;
            filter = 'drop-shadow(0px 0px 8px rgba(167, 139, 250, 0.95))';
            markerColor = '#a78bfa';
            markerSize = 22;
            animated = true;
          } else if (connectsToAnalyzer) {
            stroke = 'rgba(34, 211, 238, 0.45)'; // Soft cyan
            strokeWidth = 3.0;
            markerColor = 'rgba(34, 211, 238, 0.45)';
            markerSize = 15;
            animated = true;
          }

          return {
            ...edge,
            animated,
            style: {
              stroke,
              strokeWidth,
              filter,
              transition: 'stroke 0.25s ease, stroke-width 0.25s ease, filter 0.25s ease',
            },
            markerEnd: {
              ...edge.markerEnd,
              color: markerColor,
              width: markerSize,
              height: markerSize,
            },
          };
        } else {
          // Default styling when no node is selected (all edges animated/dashed)
          return {
            ...edge,
            animated: true,
            style: {
              stroke: 'rgba(99, 102, 241, 0.45)',
              strokeWidth: 2,
              filter: 'none',
              transition: 'stroke 0.25s ease, stroke-width 0.25s ease, filter 0.25s ease',
            },
            markerEnd: {
              ...edge.markerEnd,
              color: '#6366f1',
              width: 15,
              height: 15,
            },
          };
        }
      })
    );
  }, [searchQuery, selectedNodeId, analyzerResults, initialEdges, setNodes, setEdges]);

  // Center canvas on a specific node
  const handleSelectNode = useCallback(
    (nodeId) => {
      setIsEditing(false); // Reset edit state on navigation
      setSelectedNodeId(nodeId);
      
      // Auto toggle panels on mobile
      if (isMobile) {
        setIsLeftOpen(false);
        setIsRightOpen(true);
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        fitView({
          nodes: [{ id: nodeId }],
          duration: 800,
          maxZoom: 1.1,
          padding: 0.2,
        });
      }
    },
    [nodes, fitView, isMobile]
  );

  // React Flow node click event
  const onNodeClick = useCallback(
    (_, node) => {
      setIsEditing(false); // Reset edit state on click
      setSelectedNodeId(node.id);
      
      // Auto open detail drawer on mobile
      if (isMobile) {
        setIsLeftOpen(false);
        setIsRightOpen(true);
      }
    },
    [isMobile]
  );

  // Close drawers when clicking empty space on canvas (mobile helper) and reset selected node highlight
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null); // Reset selection/highlighting on background click
    if (isMobile) {
      setIsLeftOpen(false);
      setIsRightOpen(false);
    }
  }, [isMobile]);

  // Get active node detail
  const activeNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return currentGraphData.nodes.find((node) => node.id === selectedNodeId);
  }, [selectedNodeId, currentGraphData]);

  // Compute connected nodes (parents & children) for activeNode
  const connectedNodes = useMemo(() => {
    if (!activeNode) return { parents: [], children: [] };
    
    const parents = [];
    const children = [];
    
    currentGraphData.edges.forEach((edge) => {
      if (edge.target === activeNode.id) {
        const parentNode = currentGraphData.nodes.find(n => n.id === edge.source);
        if (parentNode) parents.push(parentNode);
      }
      if (edge.source === activeNode.id) {
        const childNode = currentGraphData.nodes.find(n => n.id === edge.target);
        if (childNode) children.push(childNode);
      }
    });
    
    return { parents, children };
  }, [activeNode, currentGraphData]);

  // Save modified markdown to file
  const handleSave = async () => {
    if (!activeNode) return;
    
    // Check if we are running in static hosting environments like github.io or vercel.app
    if (window.location.hostname.endsWith('github.io') || window.location.hostname.endsWith('vercel.app')) {
      setToastMessage('⚠️ 정적 호스팅 환경(GitHub/Vercel)에서는 파일 저장 기능이 비활성화됩니다. 로컬에서 실행해 주세요!');
      setIsEditing(false);
      return;
    }
    
    try {
      const response = await fetch('/api/save-node', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: activeNode.id, content: editContent }),
      });
      
      if (!response.ok) throw new Error('저장에 실패했습니다.');
      
      const updatedData = await response.json();
      setCurrentGraphData(updatedData);
      setIsEditing(false);
      setToastMessage('성공적으로 저장되었습니다!');
    } catch (err) {
      console.error(err);
      setToastMessage('저장 중 오류가 발생했습니다. 로컬 서버 상태를 확인해 주세요.');
    }
  };

  // Delete node file
  const handleDelete = async () => {
    if (!activeNode) return;
    
    // Check if we are running in static hosting environments like github.io or vercel.app
    if (window.location.hostname.endsWith('github.io') || window.location.hostname.endsWith('vercel.app')) {
      setToastMessage('⚠️ 정적 호스팅 환경(GitHub/Vercel)에서는 파일 삭제 기능이 비활성화됩니다. 로컬에서 실행해 주세요!');
      return;
    }

    if (!window.confirm(`정말 '${activeNode.id}' 노드와 연결된 마크다운 파일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete-node', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: activeNode.id }),
      });

      if (!response.ok) throw new Error('삭제에 실패했습니다.');

      const updatedData = await response.json();
      setCurrentGraphData(updatedData);
      setSelectedNodeId(null);
      setToastMessage('성공적으로 삭제되었습니다!');
    } catch (err) {
      console.error(err);
      setToastMessage('삭제 중 오류가 발생했습니다. 로컬 서버 상태를 확인해 주세요.');
    }
  };

  // Open the lightbox view
  const handleOpenLightbox = (imgUrl, title) => {
    setLightboxImage(imgUrl);
    setLightboxTitle(title);
  };

  // Simple Markdown inline parser with wiki-link navigation support
  const parseInlineContent = (text, allNodes, onLinkClick) => {
    if (!text) return '';
    const regex = /(\[\[.*?\]\]|\*\*.*?\*\*)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const inner = part.substring(2, part.length - 2);
        const linkParts = inner.split('|');
        const targetId = linkParts[0].split('#')[0].trim();
        const displayLabel = linkParts[1] ? linkParts[1].trim() : targetId;

        const targetExists = allNodes.some((n) => n.id === targetId && n.exists);

        return (
          <span
            key={index}
            className={`wikilink ${!targetExists ? 'missing' : ''}`}
            onClick={() => targetExists && onLinkClick(targetId)}
            title={targetExists ? `${targetId} 노드로 이동` : '외부 노드 (파일 없음)'}
          >
            {displayLabel}
          </span>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.substring(2, part.length - 2)}</strong>;
      }
      return part;
    });
  };

  // Convert raw markdown to React components
  const renderMarkdown = (text, allNodes, onLinkClick) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Obsidian Image Embed: ![[image_filename.png]]
      const obsImgMatch = trimmed.match(/^!\[\[(.*?)\]\]/);
      if (obsImgMatch) {
        const imgName = obsImgMatch[1].split('|')[0].trim();
        const base = import.meta.env.BASE_URL || '/';
        const imgUrl = `${base}QuickShare_2606211040/${imgName}`;
        
        return (
          <div key={idx} className="detail-illustration-container" style={{ margin: '14px 0', border: '1px solid var(--border-primary)', borderRadius: '8px', overflow: 'hidden' }}>
            <img 
              src={imgUrl} 
              alt={imgName}
              style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
              onClick={() => handleOpenLightbox(imgUrl, imgName)}
              onError={(e) => {
                // Hide if file is missing in the vault
                e.target.style.display = 'none';
              }}
            />
          </div>
        );
      }

      // Standard Markdown Image: ![alt](url)
      const mdImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)/);
      if (mdImgMatch) {
        const altText = mdImgMatch[1];
        let imgUrl = mdImgMatch[2].trim();

        // Resolve relative paths inside the vault
        if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('./')) {
          const base = import.meta.env.BASE_URL || '/';
          imgUrl = `${base}QuickShare_2606211040/${imgUrl}`;
        }

        return (
          <div key={idx} className="detail-illustration-container" style={{ margin: '14px 0', border: '1px solid var(--border-primary)', borderRadius: '8px', overflow: 'hidden' }}>
            <img 
              src={imgUrl} 
              alt={altText}
              style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
              onClick={() => handleOpenLightbox(imgUrl, altText)}
            />
          </div>
        );
      }

      // Heading 1
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="md-h1">
            {parseInlineContent(trimmed.substring(2), allNodes, onLinkClick)}
          </h1>
        );
      }
      // Heading 2
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="md-h2">
            {parseInlineContent(trimmed.substring(3), allNodes, onLinkClick)}
          </h2>
        );
      }
      // Heading 3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="md-h3">
            {parseInlineContent(trimmed.substring(4), allNodes, onLinkClick)}
          </h3>
        );
      }
      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="md-li">
            {parseInlineContent(trimmed.substring(2), allNodes, onLinkClick)}
          </li>
        );
      }
      // Empty lines
      if (trimmed === '') {
        return <div key={idx} className="md-spacer" style={{ height: '10px' }} />;
      }
      // Default paragraph
      return (
        <p key={idx} className="md-p">
          {parseInlineContent(line, allNodes, onLinkClick)}
        </p>
      );
    });
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = currentGraphData.nodes.length;
    const local = currentGraphData.nodes.filter(n => n.exists).length;
    const external = total - local;
    return { total, local, external };
  }, [currentGraphData]);

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* Global Header Bar */}
      <header className="app-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'rgba(15, 23, 42, 0.9)',
        borderBottom: '1px solid var(--border-primary)',
        zIndex: 100,
        backdropFilter: 'blur(12px)',
        height: '60px',
        flexShrink: 0
      }}>
        <div className="header-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain size={24} style={{ color: '#818cf8', filter: 'drop-shadow(0 0 8px rgba(129,140,248,0.5))' }} />
          <div>
            <h1 style={{ fontSize: '0.95rem', fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              Anatomical Compensation Pattern Analyzer
            </h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Obsidian 지식 맵 & AI 골격 진단 플랫폼</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="header-tabs" style={{ display: 'flex', gap: '8px', background: 'rgba(5, 8, 15, 0.5)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <button 
            className={`header-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeTab === 'map' ? 'var(--color-local)' : 'transparent',
              color: activeTab === 'map' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🗺️ 보상 패턴 맵
          </button>
          <button 
            className={`header-tab-btn ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeTab === 'analyzer' ? 'var(--color-local)' : 'transparent',
              color: activeTab === 'analyzer' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Camera size={14} />
            AI 체형 분석실
          </button>
        </div>

        {/* Analyzer Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {analyzerResults.length > 0 ? (
            <div className="header-status-badge" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(34, 211, 238, 0.1)', 
              border: '1px solid rgba(34, 211, 238, 0.25)', 
              borderRadius: '6px', 
              padding: '4px 10px',
              fontSize: '0.72rem',
              color: '#22d3ee'
            }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22d3ee' }}></span>
              <span>체형 불균형 분석 활성 ({analyzerResults.length})</span>
              <button 
                onClick={() => {
                  setAnalyzerResults([]);
                  setToastMessage('체형 분석 결과가 초기화되었습니다.');
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.65rem'
                }}
              >
                초기화
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              체형 진단 비활성
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', width: '100%' }}>
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast-notification">
            {toastMessage}
          </div>
        )}

        {/* Full Screen Lightbox Modal */}
        {lightboxImage && (
          <div 
            className="lightbox-overlay" 
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(5, 8, 15, 0.95)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              cursor: 'zoom-out',
              animation: 'fadeIn 0.25s ease'
            }}
          >
            <button 
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img 
              src={lightboxImage} 
              alt={lightboxTitle} 
              style={{
                maxWidth: '90%',
                maxHeight: '80%',
                borderRadius: '12px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            />
            <h3 style={{ marginTop: '20px', color: 'var(--text-primary)', fontWeight: '600' }}>
              {lightboxTitle} 해부학 해설도
            </h3>
          </div>
        )}

        {/* Tab 1: Map View */}
        {activeTab === 'map' && (
          <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
            
            {/* Floating Toggle Buttons (Mobile Only) */}
            {isMobile && (
              <>
                <button 
                  className={`floating-toggle left ${isLeftOpen ? 'hidden' : ''}`}
                  onClick={() => {
                    setIsLeftOpen(true);
                    setIsRightOpen(false); // Collapsed detailed sidebar
                  }}
                  title="검색 및 목록 열기"
                >
                  <Search size={18} />
                </button>
                {activeNode && (
                  <button 
                    className={`floating-toggle right ${isRightOpen ? 'hidden' : ''}`}
                    onClick={() => {
                      setIsRightOpen(true);
                      setIsLeftOpen(false); // Collapse search sidebar
                    }}
                    title="상세 정보 열기"
                  >
                    <Sliders size={18} />
                  </button>
                )}
              </>
            )}

            {/* Left Sidebar (Search, Info, Node List) */}
            <div className={`sidebar left ${isLeftOpen ? 'open' : 'collapsed'}`}>
              <div className="sidebar-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="sidebar-title">
                    <Brain size={22} className="text-indigo-400" />
                    Obsidian 보상 패턴 맵
                  </div>
                  {isMobile && (
                    <button className="sidebar-close-btn" onClick={() => setIsLeftOpen(false)}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="sidebar-subtitle">해부학적 기능 보상 시각화 분석기</div>
              </div>

              <div className="sidebar-content">
                <div className="search-container">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="패턴/통증 검색..."
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">전체 노드</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#818cf8' }}>{stats.local}</div>
                    <div className="stat-label">로컬 파일</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#94a3b8' }}>{stats.external}</div>
                    <div className="stat-label">미작성 연결</div>
                  </div>
                </div>

                {analyzerResults.length > 0 && (
                  <div style={{
                    background: 'rgba(34, 211, 238, 0.08)',
                    border: '1px solid rgba(34, 211, 238, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Sparkles size={12} />
                      진단 감지 필터 활성화됨
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '8px' }}>
                      체형 분석을 통해 감지된 뼈대 불균형 노드들과 직접적인 연결 경로들이 하이라이트 표시됩니다.
                    </p>
                    <button 
                      onClick={() => setAnalyzerResults([])}
                      style={{
                        width: '100%',
                        background: 'rgba(34, 211, 238, 0.15)',
                        border: '1px solid rgba(34, 211, 238, 0.3)',
                        borderRadius: '4px',
                        color: '#22d3ee',
                        fontSize: '0.68rem',
                        padding: '4px 0',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      전체 하이라이트 해제
                    </button>
                  </div>
                )}

                <div className="node-list">
                  {filteredNodesList.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    filteredNodesList.map((node) => (
                      <div
                        key={node.id}
                        className={`node-list-item ${selectedNodeId === node.id ? 'selected' : ''} ${analyzerResults.includes(node.id) ? 'analyzer-flagged' : ''}`}
                        onClick={() => handleSelectNode(node.id)}
                        style={analyzerResults.includes(node.id) ? {
                          borderLeft: '4px solid #22d3ee',
                          background: 'rgba(34, 211, 238, 0.05)'
                        } : {}}
                      >
                        <div className="node-list-item-header">
                          <span className="node-list-item-title" style={analyzerResults.includes(node.id) ? { color: '#22d3ee', fontWeight: '700' } : {}}>{node.id}</span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {analyzerResults.includes(node.id) && (
                              <span style={{ fontSize: '0.58rem', padding: '1px 4px', borderRadius: '3px', background: '#22d3ee', color: '#0b0f19', fontWeight: '700' }}>
                                진단
                              </span>
                            )}
                            <span className={`node-list-item-tag ${node.exists ? 'local' : 'external'}`}>
                              {node.exists ? '로컬' : '외부'}
                            </span>
                          </div>
                        </div>
                        {node.summary && (
                          <span className="node-list-item-desc">
                            {node.summary.replace(/\n/g, ' ')}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Main Canvas Area */}
            <div className="canvas-container">
              {/* Layout direction toolbar */}
              <div className="layout-toolbar">
                <button
                  className={`toolbar-button ${direction === 'TB' ? 'active' : ''}`}
                  onClick={() => setDirection('TB')}
                  title="상하 배치 적용"
                >
                  <Network size={14} style={{ transform: 'rotate(90deg)' }} />
                  상하 계층형
                </button>
                <button
                  className={`toolbar-button ${direction === 'LR' ? 'active' : ''}`}
                  onClick={() => setDirection('LR')}
                  title="좌우 배치 적용"
                >
                  <Network size={14} />
                  좌우 계층형
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => fitView({ padding: 0.15, duration: 800 })}
                  title="화면 맞춤"
                >
                  <LayoutGrid size={14} />
                  전체 맞춤
                </button>
              </div>

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
              >
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
                <Background color="rgba(255, 255, 255, 0.05)" gap={16} size={1} />
              </ReactFlow>
            </div>

            {/* Right Sidebar (Details & Editor) */}
            <div className={`sidebar right ${isRightOpen ? 'open' : 'collapsed'}`}>
              <div className="sidebar-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {activeNode ? (
                  <div className="detail-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="detail-header" style={{ flexShrink: 0 }}>
                      <div className="detail-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="detail-meta">
                          <Folder size={14} className="text-gray-400" />
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {activeNode.group === 'external' ? '미작성 연결' : `보상패턴 볼트 / ${activeNode.group}`}
                          </span>
                        </div>
                        
                        <div className="detail-actions">
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {isEditing ? (
                              <>
                                <button className="action-button save" onClick={handleSave} title="저장">
                                  <Save size={12} />
                                  저장
                                </button>
                                <button className="action-button cancel" onClick={() => setIsEditing(false)} title="취소">
                                  <X size={12} />
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                {activeNode.exists && (
                                  <button 
                                    className="action-button cancel" 
                                    onClick={handleDelete}
                                    title="삭제"
                                    style={{ 
                                      background: 'rgba(239, 68, 68, 0.1)', 
                                      border: '1px solid rgba(239, 68, 68, 0.3)', 
                                      color: '#f87171',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      height: '28px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                  >
                                    <Trash2 size={12} />
                                    삭제
                                  </button>
                                )}
                                <button 
                                  className="action-button edit" 
                                  onClick={() => {
                                    setEditContent(activeNode.content || '');
                                    setIsEditing(true);
                                  }}
                                  title="편집"
                                >
                                  <Edit3 size={12} />
                                  편집
                                </button>
                                {isMobile && (
                                  <button className="action-button cancel" onClick={() => setIsRightOpen(false)} title="닫기" style={{ padding: '5px 7px' }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h1 className="detail-title">{activeNode.id}</h1>
                        {analyzerResults.includes(activeNode.id) && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            backgroundColor: '#22d3ee',
                            color: '#0b0f19',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            boxShadow: '0 0 8px rgba(34,211,238,0.5)'
                          }}>
                            체형 분석 진단 노드
                          </span>
                        )}
                      </div>

                      {/* Display Anatomical Zone Illustration */}
                      {nodeImages[activeNode.id] && !isEditing && (
                        <div className="detail-illustration-wrapper" style={{ marginTop: '16px' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '6px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', opacity: 0.8 }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></span>
                            이미지는 참고용입니다. 오류 발생 가능.
                          </div>
                          <div className="detail-illustration-container" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-primary)', boxShadow: '0 4px 15px rgba(0,0,0,0.35)' }}>
                            <img 
                              src={nodeImages[activeNode.id]} 
                              alt={`${activeNode.id} 시각 자료`}
                              style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
                              onClick={() => handleOpenLightbox(nodeImages[activeNode.id], activeNode.id)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="detail-body-scroll" style={{ flex: 1, overflowY: 'auto', marginTop: '16px' }}>
                      {isEditing ? (
                        <textarea
                          className="editor-textarea"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="마크다운 형식으로 내용을 편집할 수 있습니다..."
                        />
                      ) : (
                        <>
                          <div className="markdown-body">
                            {renderMarkdown(activeNode.content, currentGraphData.nodes, handleSelectNode)}
                          </div>

                          {(connectedNodes.parents.length > 0 || connectedNodes.children.length > 0) && (
                            <div className="connected-pathways-container" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-primary)', paddingBottom: '16px' }}>
                              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Network size={14} className="text-indigo-400" style={{ transform: 'rotate(90deg)' }} />
                                연결된 분석 경로
                              </h3>

                              {connectedNodes.parents.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>원인 패턴 (이전 단계)</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {connectedNodes.parents.map(parent => (
                                      <button
                                        key={parent.id}
                                        onClick={() => handleSelectNode(parent.id)}
                                        className="pathway-badge parent"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '0.75rem',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          background: 'rgba(56, 189, 248, 0.1)',
                                          border: '1px solid rgba(56, 189, 248, 0.2)',
                                          color: '#38bdf8',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
                                        }}
                                      >
                                        ← {parent.id}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {connectedNodes.children.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>결과 및 보상 패턴 (다음 단계)</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {connectedNodes.children.map(child => (
                                      <button
                                        key={child.id}
                                        onClick={() => handleSelectNode(child.id)}
                                        className="pathway-badge child"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '0.75rem',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          background: 'rgba(99, 102, 241, 0.1)',
                                          border: '1px solid rgba(99, 102, 241, 0.2)',
                                          color: '#a5b4fc',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                        }}
                                      >
                                        {child.id} →
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="detail-empty">
                    {isMobile && (
                      <button className="sidebar-close-btn" onClick={() => setIsRightOpen(false)} style={{ position: 'absolute', right: '16px', top: '16px' }}>
                        <X size={18} />
                      </button>
                    )}
                    <HelpCircle size={40} className="detail-empty-icon" />
                    <h3>분석 대상을 선택해 주세요</h3>
                    <p style={{ fontSize: '0.75rem', marginTop: '6px', color: '#64748b' }}>
                      좌측 목록이나 중앙 그래프에서 노드를 선택하면 자세한 연결 구조와 해부학적 해설을 볼 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Posture Analyzer Studio View */}
        {activeTab === 'analyzer' && (
          <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', padding: '20px' }}>
            <PostureAnalyzer 
              onApplyResults={(results) => {
                setAnalyzerResults(results);
                setActiveTab('map');
                setToastMessage('체형 분석 결과가 맵에 반영되었습니다!');
                // Auto focus on the first detected node
                if (results.length > 0) {
                  handleSelectNode(results[0]);
                }
              }}
              activeNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                setActiveTab('map');
                handleSelectNode(nodeId);
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <GraphApp />
    </ReactFlowProvider>
  );
}
