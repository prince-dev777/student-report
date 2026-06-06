import React, { useEffect, useRef } from 'react';

export default function MouseTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Grid details
    let gridItems = [];
    const spacing = 35; // Space between dashes

    // Mouse tracking
    const mouse = {
      x: undefined,
      y: undefined,
      active: false
    };

    // Calculate canvas size and build grid
    const initGrid = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      gridItems = [];
      const cols = Math.floor(canvas.width / spacing) + 2;
      const rows = Math.floor(canvas.height / spacing) + 2;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * spacing;
          const y = r * spacing;

          // Determine color based on vertical position
          let color = '#3b82f6'; // Default Blue
          const ratio = y / canvas.height;
          if (ratio < 0.35) {
            // Blue zone (Top)
            color = `hsl(${220 + Math.random() * 20}, 85%, 60%)`;
          } else if (ratio < 0.70) {
            // Pink/Red zone (Middle)
            color = `hsl(${340 + Math.random() * 20}, 85%, 60%)`;
          } else {
            // Purple zone (Bottom)
            color = `hsl(${270 + Math.random() * 20}, 80%, 65%)`;
          }

          gridItems.push({
            x,
            y,
            baseX: x,
            baseY: y,
            angle: 0,
            targetAngle: 0,
            color,
            length: 8 + Math.random() * 4, // Dash length
            thickness: 2,
            opacity: 0.15 + Math.random() * 0.15 // Soft background presence
          });
        }
      }
    };

    initGrid();
    window.addEventListener('resize', initGrid);

    // Track mouse movement
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      gridItems.forEach((item) => {
        let dx, dy;

        if (mouse.active && mouse.x !== undefined && mouse.y !== undefined) {
          // Point towards the cursor
          dx = mouse.x - item.x;
          dy = mouse.y - item.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Rotate to face cursor
          item.targetAngle = Math.atan2(dy, dx);

          // Add a subtle gravitational pull/nudge: closer dashes pull slightly towards mouse
          if (dist < 180) {
            const force = (180 - dist) / 180;
            item.x = item.baseX + (dx / dist) * force * 10;
            item.y = item.baseY + (dy / dist) * force * 10;
            // Increase opacity for dashes near the mouse
            item.currentOpacity = Math.min(item.opacity + force * 0.65, 0.85);
          } else {
            // Smoothly ease back to base coordinates
            item.x += (item.baseX - item.x) * 0.1;
            item.y += (item.baseY - item.y) * 0.1;
            item.currentOpacity = item.opacity;
          }
        } else {
          // If mouse is idle/offscreen, point in a calm default wave flow
          const time = Date.now() * 0.001;
          const waveAngle = Math.sin(item.baseX * 0.005 + item.baseY * 0.005 + time) * 0.5;
          item.targetAngle = waveAngle;
          item.x += (item.baseX - item.x) * 0.1;
          item.y += (item.baseY - item.y) * 0.1;
          item.currentOpacity = item.opacity;
        }

        // Smooth angle rotation interpolation (LERP)
        let angleDiff = item.targetAngle - item.angle;
        // Normalize angle to avoid wrapping jumps (-PI to PI)
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        item.angle += angleDiff * 0.1;

        // Draw Dash
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.globalAlpha = item.currentOpacity || item.opacity;

        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.thickness;
        ctx.lineCap = 'round';

        ctx.beginPath();
        // Draw the dash (as a short line centered on rotation point)
        ctx.moveTo(-item.length / 2, 0);
        ctx.lineTo(item.length / 2, 0);
        ctx.stroke();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', initGrid);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: -1, // Render in background behind all dashboard cards
      }}
    />
  );
}
