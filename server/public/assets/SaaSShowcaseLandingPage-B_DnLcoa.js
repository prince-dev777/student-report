import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{d as t}from"./vendor-charts-ByRd4wAk.js";import{Et as n}from"./vendor-core-CcSwyHZw.js";import{C as r,D as i,H as a,Kt as o,Nt as s,Zt as c,a as l,cn as u,i as d,it as f,l as p,o as m,w as h,z as g}from"./vendor-react-Du3guypW.js";var _=e(t(),1),v=n();function y(){let e=localStorage.getItem(`institute_logo`)||localStorage.getItem(`logo`)||`/logo.png`,t=localStorage.getItem(`institute_name`)||`Career Xone`,[n,y]=(0,_.useState)(`all`),[b,x]=(0,_.useState)(null),S=[{id:`omr`,category:`evaluation`,icon:a,tag:`Proprietary AI Tech`,title:`High-Speed AI OMR Evaluation Engine`,badge:`Sub-Second Grading`,badgeBg:`#e0f2fe`,badgeColor:`#0284c7`,desc:`Advanced computer-vision algorithm evaluates 100+ answer sheets per minute directly via high-speed flatbed scanners or smartphone camera.`,features:[`Automatic 7-template alignment (T1–T7) with skew correction`,`Multi-subject grading (Physics, Chemistry, Maths, Bio) in one scan`,`Custom negative marking (+4 / -1 or custom scoring rules)`,`Instant rank list, percentile, and subject-wise score computation`,`Visual bubble inspector with manual review and audit override`]},{id:`biometric`,category:`attendance`,icon:o,tag:`Hardware Integration`,title:`Real-Time Biometric Machine Sync (ADMS Push)`,badge:`Zero-Proxy Attendance`,badgeBg:`#ecfdf5`,badgeColor:`#059669`,desc:`Direct TCP/HTTP push listener connects with ZKTeco and standard biometric devices on local network for real-time punch capture.`,features:[`Instant In & Out punch recording with second-precision timestamp`,`Automated detection of continuous study vs unattended departures`,`Custom grace period rules for late arrivals and missed check-outs`,`Works with Fingerprint, Facial Recognition, and RFID cards`,`Hardware health monitor with auto-reconnect heartbeat`]},{id:`whatsapp`,category:`communication`,icon:f,tag:`Parent Engagement`,title:`Automated WhatsApp Messaging Engine`,badge:`100% Delivery Rate`,badgeBg:`#f0fdf4`,badgeColor:`#16a34a`,desc:`Multi-threaded automated notification service that delivers transparent daily updates directly to parents on WhatsApp without per-SMS costs.`,features:[`Instant entry and departure alert sent to parents in < 3 seconds`,`Detailed OMR exam report cards with rank, total marks & percentage`,`Automated absent alerts sent to parents after class start time`,`Multi-batch announcement broadcasts for holidays and exam schedules`,`Dedicated anti-ban rate limiting with smart queue protection`]},{id:`analytics`,category:`analytics`,icon:u,tag:`Student Intelligence`,title:`360° Academic Dossier & Student Analytics`,badge:`Deep Progress Tracking`,badgeBg:`#fef3c7`,badgeColor:`#d97706`,desc:`Complete student academic intelligence dashboard giving faculty and administration instant visibility into performance trajectories.`,features:[`Historical performance trajectory graph across all test series`,`Subject-wise strength & weakness breakdown (JEE / NEET / Boards)`,`Attendance percentage correlation with test score benchmarks`,`Downloadable consolidated PDF report cards with institute watermark`,`Searchable 5-digit roll number, batch & session archive`]},{id:`hybrid-sync`,category:`architecture`,icon:g,tag:`Hybrid Architecture`,title:`Offline-First Desktop + Cloud Sync Engine`,badge:`100% Operational Uptime`,badgeBg:`#f5f3ff`,badgeColor:`#7c3aed`,desc:`Mission-critical design ensures institute computers operate with 100% speed and reliability even during internet blackouts.`,features:[`Embedded high-speed local database handles scanning and attendance offline`,`Automatic two-way background cloud sync when internet is restored`,`Conflict-free snapshot merging with automatic database backup`,`Zero cloud downtime risk — daily operations never freeze`,`Ultra-low bandwidth consumption with delta synchronization`]},{id:`portals`,category:`portals`,icon:h,tag:`Mobile Ecosystem`,title:`Specialized Multi-Stakeholder Web Portals`,badge:`Serverless PWA`,badgeBg:`#eff6ff`,badgeColor:`#2563eb`,desc:`Tailored, feather-light (~35 KB) mobile web applications giving parents, teachers, and staff instant role-specific access anywhere.`,features:[`Parent Portal: Live attendance records, scorecards & teacher notices`,`Teacher Portal: 360° student academic dossier & 1-tap parent contact`,`Staff Attendance Web App: Rapid mobile manual punch & absent marking`,`Front-Desk Inquiry Desk: Walk-in lead pipeline & follow-up tracker`,`Installable Progressive Web App (PWA) with zero app store install needed`]},{id:`inquiries`,category:`crm`,icon:p,tag:`Admissions CRM`,title:`Front-Desk Inquiry & Admission Pipeline`,badge:`Conversion Booster`,badgeBg:`#fff1f2`,badgeColor:`#e11d48`,desc:`Capture, organize, and follow up with prospective students and parents from first walk-in to confirmed admission.`,features:[`Quick mobile entry for student details, target course & previous scores`,`Lead status tracking: Pending, Follow-up, Admitted, or Archived`,`1-Tap WhatsApp chat initiation and direct phone dialing`,`Staff follow-up notes and callback scheduling reminders`,`Real-time synchronization between front desk and admin office`]},{id:`questions`,category:`evaluation`,icon:s,tag:`Curriculum Tools`,title:`Integrated Test Series & Question Paper Builder`,badge:`Smart Exam Creator`,badgeBg:`#e0e7ff`,badgeColor:`#4338ca`,desc:`Build, schedule, and print competitive exam papers and customized OMR bubble answer sheets in just a few clicks.`,features:[`Comprehensive question bank covering JEE Main, Advanced & NEET syllabus`,`Chapter-wise and topic-wise difficulty filtering (Easy, Medium, Hard)`,`Automatic answer key generation matching OMR scanner templates`,`Export printable high-resolution PDF question booklets`,`Multi-batch assignment with custom exam schedules and duration`]}],C=[{num:`01`,title:`Data Capture`,desc:`Students punch biometric device or fill physical OMR sheets during scheduled test exams.`,icon:o,color:`#0284c7`},{num:`02`,title:`Instant Processing`,desc:`High-speed AI engine checks 100 sheets/min and biometrics record attendance in milliseconds.`,icon:d,color:`#0ea5e9`},{num:`03`,title:`Parent Alerting`,desc:`Parents instantly receive punch arrival/departure alerts and test scorecards on WhatsApp.`,icon:f,color:`#10b981`},{num:`04`,title:`Academic Analytics`,desc:`Management and teachers track live batches, rank distributions, and progress trends 24/7.`,icon:u,color:`#6366f1`}],w=n===`all`?S:S.filter(e=>e.category===n);return(0,v.jsxs)(`div`,{style:{minHeight:`100vh`,background:`linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 30%, #f8fafc 100%)`,color:`#0f172a`,fontFamily:`'Outfit', 'Inter', -apple-system, sans-serif`,position:`relative`,overflowX:`hidden`},children:[(0,v.jsx)(`style`,{children:`
        * {
          box-sizing: border-box;
        }
        .saas-header {
          padding: 12px 5%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(186, 230, 253, 0.7);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 4px 20px -2px rgba(14, 165, 233, 0.08);
        }
        .saas-header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-shrink: 0;
        }
        .saas-hero {
          padding: 48px 5% 32px;
          text-align: center;
          max-width: 1080px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        .saas-tabs-container {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 32px;
        }
        .saas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }
        .saas-workflow-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        .saas-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .saas-hero-cta {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 24px;
          margin-bottom: 10px;
        }

        /* 📱 Tablets, Split-screen DevTools & Compact Viewports (< 960px) */
        @media (max-width: 960px) {
          .saas-header {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .saas-brand-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
          }
          .saas-brand-sub {
            display: none !important;
          }
          .saas-header-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .saas-header-btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 9px 6px !important;
            font-size: 0.76rem !important;
            border-radius: 10px !important;
            white-space: nowrap !important;
          }
          .saas-hero {
            padding: 24px 14px 18px !important;
          }
          .saas-hero-pill {
            font-size: 0.72rem !important;
            padding: 5px 12px !important;
            margin-bottom: 12px !important;
            line-height: 1.35 !important;
            max-width: 100% !important;
            text-align: center !important;
          }
          .saas-hero h1 {
            font-size: clamp(1.65rem, 6.2vw, 2.2rem) !important;
            line-height: 1.22 !important;
            margin-bottom: 12px !important;
            letter-spacing: -0.5px !important;
          }
          .saas-hero p {
            font-size: 0.88rem !important;
            line-height: 1.5 !important;
            margin-bottom: 18px !important;
            padding: 0 4px !important;
          }
          .saas-hero-cta {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 10px !important;
            margin-top: 16px !important;
          }
          .saas-hero-cta button {
            width: 100% !important;
            padding: 12px 16px !important;
            font-size: 0.88rem !important;
            border-radius: 12px !important;
            justify-content: center !important;
          }
          .saas-pillar-pill {
            font-size: 0.72rem !important;
            padding: 5px 10px !important;
          }
          .saas-tabs-section {
            padding: 0 12px !important;
          }
          .saas-tabs-container {
            justify-content: flex-start !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            padding: 4px 2px 10px !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            gap: 8px !important;
          }
          .saas-tabs-container::-webkit-scrollbar {
            display: none;
          }
          .saas-tab-btn {
            flex-shrink: 0 !important;
            font-size: 0.76rem !important;
            padding: 7px 14px !important;
            white-space: nowrap !important;
          }
          .saas-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .saas-card {
            padding: 18px 14px !important;
            border-radius: 16px !important;
          }
          .saas-workflow-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .saas-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .saas-modal-container {
            padding: 16px 12px !important;
            border-radius: 18px !important;
            max-height: 92vh !important;
            width: calc(100vw - 18px) !important;
          }
          .saas-modal-header h3 {
            font-size: 1.10rem !important;
          }
          .saas-security-banner {
            padding: 20px 14px !important;
            border-radius: 18px !important;
            flex-direction: column !important;
            gap: 16px !important;
          }
        }

        /* 📱 Extra Small Phones (< 380px) */
        @media (max-width: 380px) {
          .saas-header-btn {
            font-size: 0.68rem !important;
            padding: 7px 4px !important;
            gap: 4px !important;
          }
          .saas-header-btn svg {
            width: 12px !important;
            height: 12px !important;
          }
        }
      `}),(0,v.jsx)(`div`,{style:{position:`absolute`,top:`-150px`,left:`50%`,transform:`translateX(-50%)`,width:`900px`,height:`450px`,background:`radial-gradient(ellipse at top, rgba(56, 189, 248, 0.25) 0%, rgba(224, 242, 254, 0) 70%)`,pointerEvents:`none`,zIndex:0}}),(0,v.jsxs)(`header`,{className:`saas-header`,children:[(0,v.jsx)(`div`,{className:`saas-brand-row`,children:(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`10px`},children:[(0,v.jsx)(`img`,{src:e,alt:`Logo`,style:{width:`38px`,height:`38px`,borderRadius:`10px`,objectFit:`contain`,background:`#ffffff`,padding:`3px`,border:`1px solid #bae6fd`,boxShadow:`0 2px 8px rgba(14, 165, 233, 0.15)`},onError:e=>{e.currentTarget.style.display=`none`}}),(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(`h2`,{style:{margin:0,fontSize:`1.15rem`,fontWeight:900,color:`#0369a1`,letterSpacing:`-0.4px`},children:t}),(0,v.jsx)(`span`,{style:{background:`linear-gradient(135deg, #0284c7, #0369a1)`,color:`#ffffff`,fontSize:`0.62rem`,fontWeight:800,padding:`2px 7px`,borderRadius:`5px`,letterSpacing:`0.5px`},children:`ERP`})]}),(0,v.jsx)(`span`,{className:`saas-brand-sub`,style:{fontSize:`0.72rem`,color:`#64748b`,fontWeight:500},children:`Institute Automation & Student Analytics`})]})]})}),(0,v.jsxs)(`div`,{className:`saas-header-actions`,children:[(0,v.jsxs)(`button`,{onClick:()=>x(`parent`),className:`saas-header-btn`,style:{background:`#ffffff`,border:`1.5px solid #bae6fd`,color:`#0284c7`,padding:`8px 14px`,borderRadius:`10px`,fontSize:`0.80rem`,fontWeight:800,display:`inline-flex`,alignItems:`center`,gap:`6px`,boxShadow:`0 2px 6px rgba(14, 165, 233, 0.08)`,cursor:`pointer`,transition:`all 0.15s ease`},children:[(0,v.jsx)(p,{size:14}),` Parent App (Demo)`]}),(0,v.jsxs)(`button`,{onClick:()=>x(`teacher`),className:`saas-header-btn`,style:{background:`linear-gradient(135deg, #0284c7, #0369a1)`,border:`none`,color:`#ffffff`,padding:`8px 14px`,borderRadius:`10px`,fontSize:`0.80rem`,fontWeight:800,display:`inline-flex`,alignItems:`center`,gap:`6px`,boxShadow:`0 4px 12px rgba(2, 132, 199, 0.25)`,cursor:`pointer`,transition:`all 0.15s ease`},children:[(0,v.jsx)(r,{size:14}),` Faculty App (Demo)`]})]})]}),(0,v.jsxs)(`section`,{className:`saas-hero`,children:[(0,v.jsxs)(`div`,{className:`saas-hero-pill`,style:{display:`inline-flex`,alignItems:`center`,gap:`8px`,background:`rgba(255, 255, 255, 0.92)`,border:`1px solid #7dd3fc`,padding:`6px 18px`,borderRadius:`50px`,fontSize:`0.82rem`,color:`#0369a1`,fontWeight:700,boxShadow:`0 4px 14px rgba(14, 165, 233, 0.12)`,marginBottom:`20px`},children:[(0,v.jsx)(r,{size:14,color:`#0284c7`}),`Complete Institute Automation & Student Analytics Ecosystem`]}),(0,v.jsxs)(`h1`,{style:{fontSize:`clamp(2.1rem, 5vw, 3.4rem)`,fontWeight:900,lineHeight:1.15,marginBottom:`18px`,color:`#0f172a`,letterSpacing:`-1px`},children:[`Powering Modern Coaching & Institutes with`,` `,(0,v.jsx)(`span`,{style:{background:`linear-gradient(135deg, #0284c7 0%, #0369a1 100%)`,WebkitBackgroundClip:`text`,WebkitTextFillColor:`transparent`},children:`Automated Intelligence`})]}),(0,v.jsx)(`p`,{style:{fontSize:`1.1rem`,color:`#475569`,lineHeight:1.6,marginBottom:`28px`,maxWidth:`820px`,margin:`0 auto 28px`,fontWeight:450},children:`From optical OMR evaluation and real-time biometric tracking to instant WhatsApp scorecards and comprehensive student dossiers — an all-in-one software platform built for high reliability, zero proxy, and effortless academic administration.`}),(0,v.jsxs)(`div`,{className:`saas-hero-cta`,children:[(0,v.jsxs)(`button`,{onClick:()=>x(`parent`),style:{background:`linear-gradient(135deg, #0284c7, #0369a1)`,color:`#ffffff`,border:`none`,padding:`12px 24px`,borderRadius:`12px`,fontSize:`0.94rem`,fontWeight:800,display:`inline-flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`,boxShadow:`0 6px 18px rgba(2, 132, 199, 0.3)`,cursor:`pointer`},children:[(0,v.jsx)(p,{size:16}),` 🚀 View Parents App Demo`]}),(0,v.jsxs)(`button`,{onClick:()=>x(`teacher`),style:{background:`#ffffff`,color:`#0369a1`,border:`1.5px solid #7dd3fc`,padding:`12px 24px`,borderRadius:`12px`,fontSize:`0.94rem`,fontWeight:800,display:`inline-flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`,boxShadow:`0 4px 12px rgba(14, 165, 233, 0.1)`,cursor:`pointer`},children:[(0,v.jsx)(r,{size:16}),` 👨‍🏫 View Faculty Portal Demo`]})]}),(0,v.jsx)(`div`,{style:{display:`flex`,flexWrap:`wrap`,justifyContent:`center`,gap:`8px`,marginTop:`24px`},children:[{text:`Sub-Second AI OMR Grading`,icon:a},{text:`Real-time Biometric Push Sync`,icon:o},{text:`Automated WhatsApp Delivery`,icon:f},{text:`Offline-First Hybrid Architecture`,icon:m},{text:`Multi-Stakeholder Web Portals`,icon:h}].map((e,t)=>{let n=e.icon;return(0,v.jsxs)(`div`,{className:`saas-pillar-pill`,style:{display:`inline-flex`,alignItems:`center`,gap:`6px`,background:`#ffffff`,border:`1px solid #bae6fd`,padding:`6px 14px`,borderRadius:`50px`,fontSize:`0.78rem`,color:`#0369a1`,fontWeight:600,boxShadow:`0 2px 6px rgba(14, 165, 233, 0.06)`},children:[(0,v.jsx)(n,{size:13,color:`#0284c7`}),(0,v.jsx)(`span`,{children:e.text})]},t)})})]}),(0,v.jsxs)(`section`,{className:`saas-tabs-section`,style:{maxWidth:`1240px`,margin:`0 auto 24px`,padding:`0 5%`},children:[(0,v.jsx)(`div`,{className:`saas-tabs-container`,children:[{id:`all`,label:`All System Modules`},{id:`evaluation`,label:`AI OMR & Exams`},{id:`attendance`,label:`Biometrics & Attendance`},{id:`communication`,label:`WhatsApp Alerts`},{id:`analytics`,label:`Student Dossier & Analytics`},{id:`portals`,label:`Mobile Portals`},{id:`architecture`,label:`Offline Hybrid Sync`}].map(e=>(0,v.jsx)(`button`,{onClick:()=>y(e.id),className:`saas-tab-btn`,style:{background:n===e.id?`#0284c7`:`#ffffff`,color:n===e.id?`#ffffff`:`#0369a1`,border:n===e.id?`1px solid #0284c7`:`1px solid #bae6fd`,padding:`8px 18px`,borderRadius:`30px`,fontSize:`0.84rem`,fontWeight:700,cursor:`pointer`,transition:`all 0.2s ease`,boxShadow:n===e.id?`0 4px 12px rgba(2, 132, 199, 0.3)`:`0 2px 6px rgba(14, 165, 233, 0.06)`},children:e.label},e.id))}),(0,v.jsx)(`div`,{className:`saas-grid`,children:w.map(e=>{let t=e.icon;return(0,v.jsx)(`div`,{className:`saas-card`,style:{background:`rgba(255, 255, 255, 0.88)`,border:`1px solid #bae6fd`,borderRadius:`22px`,padding:`26px`,display:`flex`,flexDirection:`column`,justifyContent:`space-between`,boxShadow:`0 10px 28px -6px rgba(14, 165, 233, 0.1), 0 4px 12px -2px rgba(14, 165, 233, 0.05)`,position:`relative`},children:(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,marginBottom:`16px`},children:[(0,v.jsx)(`div`,{style:{width:`44px`,height:`44px`,borderRadius:`12px`,background:`linear-gradient(135deg, #e0f2fe, #bae6fd)`,color:`#0284c7`,display:`flex`,alignItems:`center`,justifyContent:`center`,border:`1px solid #7dd3fc`,boxShadow:`0 4px 12px rgba(14, 165, 233, 0.12)`},children:(0,v.jsx)(t,{size:22})}),(0,v.jsx)(`span`,{style:{background:e.badgeBg,color:e.badgeColor,border:`1px solid ${e.badgeColor}33`,padding:`3px 10px`,borderRadius:`20px`,fontSize:`0.70rem`,fontWeight:800,letterSpacing:`0.3px`},children:e.badge})]}),(0,v.jsx)(`span`,{style:{fontSize:`0.70rem`,fontWeight:700,color:`#0284c7`,textTransform:`uppercase`,letterSpacing:`0.6px`},children:e.tag}),(0,v.jsx)(`h3`,{style:{fontSize:`1.20rem`,fontWeight:800,color:`#0f172a`,margin:`4px 0 8px`,lineHeight:1.3},children:e.title}),(0,v.jsx)(`p`,{style:{fontSize:`0.86rem`,color:`#475569`,lineHeight:1.55,margin:`0 0 18px`},children:e.desc}),(0,v.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`8px`,marginBottom:`8px`},children:e.features.map((e,t)=>(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`flex-start`,gap:`8px`,fontSize:`0.80rem`,color:`#334155`},children:[(0,v.jsx)(c,{size:14,color:`#0284c7`,style:{marginTop:`2px`,flexShrink:0}}),(0,v.jsx)(`span`,{children:e})]},t))})]})},e.id)})})]}),(0,v.jsxs)(`section`,{style:{maxWidth:`1240px`,margin:`50px auto 60px`,padding:`0 5%`},children:[(0,v.jsxs)(`div`,{style:{textAlign:`center`,marginBottom:`36px`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.74rem`,fontWeight:800,color:`#0284c7`,textTransform:`uppercase`,letterSpacing:`0.8px`},children:`Seamless Daily Workflow`}),(0,v.jsx)(`h2`,{style:{fontSize:`1.85rem`,fontWeight:900,color:`#0f172a`,margin:`6px 0 8px`,letterSpacing:`-0.5px`},children:`How The Ecosystem Operates Every Day`}),(0,v.jsx)(`p`,{style:{fontSize:`0.90rem`,color:`#64748b`,maxWidth:`650px`,margin:`0 auto`},children:`Completely automated pipeline from the moment students step inside the institute to the delivery of their academic scorecard.`})]}),(0,v.jsx)(`div`,{className:`saas-workflow-grid`,children:C.map((e,t)=>{let n=e.icon;return(0,v.jsx)(`div`,{style:{background:`#ffffff`,border:`1px solid #bae6fd`,borderRadius:`18px`,padding:`24px 20px`,boxShadow:`0 8px 24px -4px rgba(14, 165, 233, 0.08)`,display:`flex`,flexDirection:`column`,justifyContent:`space-between`},children:(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,marginBottom:`14px`},children:[(0,v.jsx)(`span`,{style:{fontSize:`1.3rem`,fontWeight:900,color:`#bae6fd`,fontFamily:`monospace`},children:e.num}),(0,v.jsx)(`div`,{style:{width:`38px`,height:`38px`,borderRadius:`10px`,background:`#f0f9ff`,color:e.color,display:`flex`,alignItems:`center`,justifyContent:`center`,border:`1px solid #e0f2fe`},children:(0,v.jsx)(n,{size:18})})]}),(0,v.jsx)(`h4`,{style:{fontSize:`1.05rem`,fontWeight:800,color:`#0f172a`,margin:`0 0 6px`},children:e.title}),(0,v.jsx)(`p`,{style:{fontSize:`0.82rem`,color:`#64748b`,lineHeight:1.5,margin:0},children:e.desc})]})},t)})})]}),(0,v.jsx)(`section`,{style:{maxWidth:`1120px`,margin:`0 auto 60px`,padding:`0 5%`},children:(0,v.jsxs)(`div`,{className:`saas-security-banner`,style:{background:`linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)`,border:`1.5px solid #7dd3fc`,borderRadius:`22px`,padding:`30px 32px`,display:`flex`,alignItems:`center`,justifyContent:`space-between`,flexWrap:`wrap`,gap:`20px`,boxShadow:`0 12px 36px -8px rgba(14, 165, 233, 0.12)`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`flex-start`,gap:`16px`,maxWidth:`700px`},children:[(0,v.jsx)(`div`,{style:{width:`48px`,height:`48px`,borderRadius:`14px`,background:`linear-gradient(135deg, #0284c7, #0369a1)`,color:`#ffffff`,display:`flex`,alignItems:`center`,justifyContent:`center`,flexShrink:0,boxShadow:`0 6px 16px rgba(2, 132, 199, 0.3)`},children:(0,v.jsx)(i,{size:24})}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`h3`,{style:{margin:`0 0 4px`,fontSize:`1.15rem`,fontWeight:900,color:`#0f172a`},children:`Bank-Grade Data Privacy & Local Control`}),(0,v.jsx)(`p`,{style:{margin:0,fontSize:`0.84rem`,color:`#475569`,lineHeight:1.5},children:`Your student records, contact numbers, and test scores remain strictly private. The software functions independently on your local machines with end-to-end encrypted backup to your private cloud cluster.`})]})]}),(0,v.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`6px`,fontSize:`0.80rem`,color:`#0369a1`,fontWeight:700},children:[(0,v.jsxs)(`span`,{style:{display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(c,{size:15,color:`#0284c7`}),` Zero Third-Party Tracking`]}),(0,v.jsxs)(`span`,{style:{display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(c,{size:15,color:`#0284c7`}),` Auto Local Database Backup`]}),(0,v.jsxs)(`span`,{style:{display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(c,{size:15,color:`#0284c7`}),` 100% Offline Capable`]})]})]})}),(0,v.jsxs)(`footer`,{style:{textAlign:`center`,fontSize:`0.82rem`,color:`#64748b`,borderTop:`1px solid #bae6fd`,background:`#ffffff`,padding:`30px 5% 36px`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,justifyContent:`center`,alignItems:`center`,gap:`8px`,marginBottom:`8px`,flexWrap:`wrap`},children:[(0,v.jsx)(`img`,{src:e,alt:`Logo`,style:{width:`26px`,height:`26px`,borderRadius:`6px`,objectFit:`contain`},onError:e=>{e.currentTarget.style.display=`none`}}),(0,v.jsx)(`strong`,{style:{color:`#0f172a`,fontSize:`0.90rem`},children:t}),(0,v.jsx)(`span`,{style:{color:`#cbd5e1`},children:`•`}),(0,v.jsx)(`span`,{style:{color:`#0284c7`,fontWeight:600},children:`Institute Automation System`})]}),(0,v.jsxs)(`p`,{style:{margin:`0 0 4px`},children:[`© `,new Date().getFullYear(),` `,(0,v.jsx)(`strong`,{children:t}),`. All rights reserved.`]}),(0,v.jsx)(`p`,{style:{margin:0,fontSize:`0.74rem`,color:`#94a3b8`},children:`Equipped with Sub-Second AI OMR Evaluation • Real-Time Biometric Push Sync • Automated WhatsApp Engine • Multi-Portal Serverless Architecture`})]}),b&&(0,v.jsx)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,background:`rgba(15, 23, 42, 0.65)`,backdropFilter:`blur(8px)`,zIndex:1e3,display:`flex`,alignItems:`center`,justifyContent:`center`,padding:`12px`},children:(0,v.jsxs)(`div`,{className:`saas-modal-container`,style:{background:`#ffffff`,borderRadius:`24px`,maxWidth:`680px`,width:`100%`,maxHeight:`92vh`,overflowY:`auto`,boxShadow:`0 25px 50px -12px rgba(0, 0, 0, 0.3)`,border:`1.5px solid #7dd3fc`,padding:`24px`,position:`relative`},children:[(0,v.jsxs)(`div`,{className:`saas-modal-header`,style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,marginBottom:`14px`,borderBottom:`1px solid #e0f2fe`,paddingBottom:`12px`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`span`,{style:{background:`#e0f2fe`,color:`#0369a1`,padding:`3px 10px`,borderRadius:`20px`,fontSize:`0.70rem`,fontWeight:800,display:`inline-flex`,alignItems:`center`,gap:`5px`},children:[(0,v.jsx)(r,{size:12,color:`#0284c7`}),` SAMPLE DEMO PREVIEW • ZERO REAL DATA`]}),(0,v.jsx)(`h3`,{style:{margin:`6px 0 2px`,fontSize:`1.30rem`,fontWeight:900,color:`#0f172a`},children:b===`parent`?`Parents App Interactive Preview`:`Faculty Portal Interactive Preview`}),(0,v.jsx)(`span`,{style:{fontSize:`0.76rem`,color:`#64748b`},children:`Interactive demonstration of user interface and reporting features.`})]}),(0,v.jsx)(`button`,{onClick:()=>x(null),style:{background:`#f1f5f9`,border:`none`,borderRadius:`50%`,width:`34px`,height:`34px`,display:`flex`,alignItems:`center`,justifyContent:`center`,cursor:`pointer`,color:`#475569`,flexShrink:0},children:(0,v.jsx)(l,{size:18})})]}),(0,v.jsxs)(`div`,{style:{display:`flex`,gap:`6px`,marginBottom:`16px`,background:`#f8fafc`,padding:`4px`,borderRadius:`12px`,border:`1px solid #e2e8f0`},children:[(0,v.jsxs)(`button`,{onClick:()=>x(`parent`),style:{flex:1,padding:`8px`,borderRadius:`10px`,border:`none`,background:b===`parent`?`#0284c7`:`transparent`,color:b===`parent`?`#ffffff`:`#64748b`,fontSize:`0.82rem`,fontWeight:800,cursor:`pointer`,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`6px`},children:[(0,v.jsx)(p,{size:15}),` Parent App View`]}),(0,v.jsxs)(`button`,{onClick:()=>x(`teacher`),style:{flex:1,padding:`8px`,borderRadius:`10px`,border:`none`,background:b===`teacher`?`#0284c7`:`transparent`,color:b===`teacher`?`#ffffff`:`#64748b`,fontSize:`0.82rem`,fontWeight:800,cursor:`pointer`,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`6px`},children:[(0,v.jsx)(r,{size:15}),` Faculty Portal View`]})]}),b===`parent`&&(0,v.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`12px`},children:[(0,v.jsxs)(`div`,{style:{background:`linear-gradient(135deg, #f0f9ff, #ffffff)`,border:`1px solid #bae6fd`,borderRadius:`16px`,padding:`14px`,display:`flex`,alignItems:`center`,gap:`12px`},children:[(0,v.jsx)(`div`,{style:{width:`44px`,height:`44px`,borderRadius:`12px`,background:`linear-gradient(135deg, #0284c7, #0369a1)`,color:`#ffffff`,display:`flex`,alignItems:`center`,justifyContent:`center`,fontWeight:900,fontSize:`1.1rem`,flexShrink:0},children:`AS`}),(0,v.jsxs)(`div`,{style:{flex:1,minWidth:0},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`6px`,flexWrap:`wrap`},children:[(0,v.jsx)(`h4`,{style:{margin:0,fontSize:`1rem`,fontWeight:900,color:`#0f172a`},children:`Aditya Sharma (Sample Student)`}),(0,v.jsx)(`span`,{style:{fontSize:`0.68rem`,background:`#e0f2fe`,color:`#0369a1`,padding:`1px 6px`,borderRadius:`4px`,fontWeight:700},children:`Roll: 101`})]}),(0,v.jsx)(`span`,{style:{fontSize:`0.75rem`,color:`#64748b`},children:`12th JEE Main & Advanced • Morning Apex Batch`})]})]}),(0,v.jsx)(`div`,{className:`saas-kpi-grid`,children:[{label:`Attendance`,val:`96%`,color:`#10b981`,bg:`#ecfdf5`},{label:`Present Days`,val:`24/25`,color:`#0284c7`,bg:`#f0f9ff`},{label:`Avg Test Score`,val:`268/300`,color:`#8b5cf6`,bg:`#f5f3ff`},{label:`Batch Rank`,val:`#2`,color:`#f59e0b`,bg:`#fffbeb`}].map((e,t)=>(0,v.jsxs)(`div`,{style:{background:e.bg,border:`1px solid ${e.color}33`,borderRadius:`12px`,padding:`10px 8px`,textAlign:`center`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.66rem`,color:`#64748b`,fontWeight:600,display:`block`},children:e.label}),(0,v.jsx)(`strong`,{style:{fontSize:`1rem`,color:e.color,fontWeight:900},children:e.val})]},t))}),(0,v.jsxs)(`div`,{style:{background:`#f8fafc`,border:`1px solid #e2e8f0`,borderRadius:`14px`,padding:`12px`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,marginBottom:`8px`,flexWrap:`wrap`,gap:`4px`},children:[(0,v.jsxs)(`span`,{style:{fontSize:`0.78rem`,fontWeight:800,color:`#0f172a`,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(o,{size:13,color:`#0284c7`}),` Today's Biometric Log (ADMS Push)`]}),(0,v.jsx)(`span`,{style:{fontSize:`0.68rem`,background:`#ecfdf5`,color:`#059669`,padding:`2px 7px`,borderRadius:`6px`,fontWeight:800},children:`✓ PRESENT`})]}),(0,v.jsxs)(`div`,{style:{display:`flex`,gap:`12px`,fontSize:`0.78rem`,color:`#334155`,flexWrap:`wrap`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`strong`,{children:`Punch In:`}),` 07:45 AM`]}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`strong`,{children:`Punch Out:`}),` 01:30 PM`]}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`strong`,{children:`Study Hours:`}),` 5h 45m`]})]})]}),(0,v.jsxs)(`div`,{style:{background:`#f8fafc`,border:`1px solid #e2e8f0`,borderRadius:`14px`,padding:`12px`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,marginBottom:`8px`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`h5`,{style:{margin:0,fontSize:`0.88rem`,fontWeight:800,color:`#0f172a`},children:`JEE Advanced Full Mock #04`}),(0,v.jsx)(`span`,{style:{fontSize:`0.70rem`,color:`#64748b`},children:`Evaluated by AI OMR Scanner`})]}),(0,v.jsxs)(`div`,{style:{textAlign:`right`},children:[(0,v.jsx)(`span`,{style:{fontSize:`1.05rem`,fontWeight:900,color:`#0284c7`},children:`268 / 300`}),(0,v.jsx)(`span`,{style:{fontSize:`0.65rem`,color:`#10b981`,display:`block`,fontWeight:700},children:`99.12 %ile`})]})]}),(0,v.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(3, 1fr)`,gap:`6px`,fontSize:`0.72rem`,textAlign:`center`},children:[(0,v.jsxs)(`div`,{style:{background:`#ffffff`,padding:`5px`,borderRadius:`8px`,border:`1px solid #e2e8f0`},children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`Physics:`}),` `,(0,v.jsx)(`strong`,{children:`92/100`})]}),(0,v.jsxs)(`div`,{style:{background:`#ffffff`,padding:`5px`,borderRadius:`8px`,border:`1px solid #e2e8f0`},children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`Chemistry:`}),` `,(0,v.jsx)(`strong`,{children:`88/100`})]}),(0,v.jsxs)(`div`,{style:{background:`#ffffff`,padding:`5px`,borderRadius:`8px`,border:`1px solid #e2e8f0`},children:[(0,v.jsx)(`span`,{style:{color:`#64748b`},children:`Maths:`}),` `,(0,v.jsx)(`strong`,{children:`88/100`})]})]})]})]}),b===`teacher`&&(0,v.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`12px`},children:[(0,v.jsxs)(`div`,{style:{background:`linear-gradient(135deg, #f0f9ff, #ffffff)`,border:`1px solid #bae6fd`,borderRadius:`16px`,padding:`14px`,display:`flex`,alignItems:`center`,justifyContent:`space-between`,flexWrap:`wrap`,gap:`8px`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`h4`,{style:{margin:0,fontSize:`1rem`,fontWeight:900,color:`#0f172a`},children:`Prof. R. K. Verma (Faculty View)`}),(0,v.jsx)(`span`,{style:{fontSize:`0.75rem`,color:`#64748b`},children:`12th JEE Apex (Morning Batch) • 45 Students`})]}),(0,v.jsx)(`span`,{style:{background:`#e0f2fe`,color:`#0369a1`,padding:`3px 8px`,borderRadius:`6px`,fontSize:`0.72rem`,fontWeight:800},children:`Senior Mentor`})]}),(0,v.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(3, 1fr)`,gap:`8px`},children:[(0,v.jsxs)(`div`,{style:{background:`#f0fdf4`,border:`1px solid #bbf7d0`,borderRadius:`12px`,padding:`10px 6px`,textAlign:`center`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.66rem`,color:`#64748b`,fontWeight:600,display:`block`},children:`Attendance`}),(0,v.jsx)(`strong`,{style:{fontSize:`1.05rem`,color:`#16a34a`,fontWeight:900},children:`42 / 45`})]}),(0,v.jsxs)(`div`,{style:{background:`#eff6ff`,border:`1px solid #bfdbfe`,borderRadius:`12px`,padding:`10px 6px`,textAlign:`center`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.66rem`,color:`#64748b`,fontWeight:600,display:`block`},children:`Batch Avg`}),(0,v.jsx)(`strong`,{style:{fontSize:`1.05rem`,color:`#2563eb`,fontWeight:900},children:`214/300`})]}),(0,v.jsxs)(`div`,{style:{background:`#faf5ff`,border:`1px solid #e9d5ff`,borderRadius:`12px`,padding:`10px 6px`,textAlign:`center`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.66rem`,color:`#64748b`,fontWeight:600,display:`block`},children:`High Score`}),(0,v.jsx)(`strong`,{style:{fontSize:`1.05rem`,color:`#7c3aed`,fontWeight:900},children:`285/300`})]})]}),(0,v.jsxs)(`div`,{style:{border:`1px solid #e2e8f0`,borderRadius:`14px`,overflow:`hidden`},children:[(0,v.jsx)(`div`,{style:{background:`#f8fafc`,padding:`8px 12px`,borderBottom:`1px solid #e2e8f0`,fontWeight:800,fontSize:`0.76rem`,color:`#475569`},children:`Sample Student Dossier Table (Demo)`}),[{name:`Aditya Sharma`,roll:`101`,att:`96%`,score:`268/300`,status:`Top 5%`},{name:`Sneha Patel`,roll:`102`,att:`92%`,score:`254/300`,status:`Top 10%`},{name:`Aman Gupta`,roll:`103`,att:`88%`,score:`232/300`,status:`Consistent`},{name:`Priya Singh`,roll:`104`,att:`94%`,score:`248/300`,status:`Top 15%`}].map((e,t)=>(0,v.jsxs)(`div`,{style:{padding:`8px 12px`,display:`flex`,alignItems:`center`,justifyContent:`space-between`,flexWrap:`wrap`,gap:`6px`,borderBottom:t<3?`1px solid #f1f5f9`:`none`,fontSize:`0.78rem`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`strong`,{children:e.name}),` `,(0,v.jsxs)(`span`,{style:{color:`#94a3b8`},children:[`(Roll: `,e.roll,`)`]})]}),(0,v.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,alignItems:`center`},children:[(0,v.jsx)(`span`,{style:{color:`#059669`,fontWeight:700},children:e.att}),(0,v.jsx)(`span`,{style:{color:`#0284c7`,fontWeight:700},children:e.score}),(0,v.jsx)(`span`,{style:{background:`#f1f5f9`,padding:`1px 6px`,borderRadius:`4px`,fontSize:`0.68rem`,fontWeight:600},children:e.status})]})]},t))]})]}),(0,v.jsxs)(`div`,{style:{marginTop:`16px`,paddingTop:`12px`,borderTop:`1px solid #e2e8f0`,display:`flex`,justifyContent:`space-between`,alignItems:`center`,flexWrap:`wrap`,gap:`10px`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`2px`},children:[(0,v.jsx)(`span`,{style:{fontSize:`0.70rem`,color:`#94a3b8`},children:`🔒 Simulated preview. Zero database queries.`}),b===`parent`?(0,v.jsx)(`a`,{href:`#/parent`,style:{fontSize:`0.74rem`,color:`#0284c7`,fontWeight:800,textDecoration:`none`},children:`Open Actual Parent Portal Login →`}):(0,v.jsx)(`a`,{href:`#/teacher`,style:{fontSize:`0.74rem`,color:`#0284c7`,fontWeight:800,textDecoration:`none`},children:`Open Actual Faculty Portal →`})]}),(0,v.jsx)(`button`,{onClick:()=>x(null),style:{background:`#0284c7`,color:`#ffffff`,border:`none`,padding:`8px 18px`,borderRadius:`10px`,fontWeight:800,fontSize:`0.80rem`,cursor:`pointer`},children:`Close Preview`})]})]})})]})}export{y as default};