import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{d as t}from"./vendor-charts-ByRd4wAk.js";import{Et as n,Ot as r}from"./vendor-core-CcSwyHZw.js";import{D as i,F as a,H as o,J as s,Qt as c,_ as l,a as u,cn as d,lt as f,sn as p,u as m,wn as h,yt as g}from"./vendor-react-DXAjuTxV.js";import{i as _}from"./index-Dv7piMz6.js";var v=e(t(),1),y=n();function b(){let[e,t]=(0,v.useState)([]),[n,b]=(0,v.useState)(!0),[x,S]=(0,v.useState)(!1),[C,w]=(0,v.useState)(null),[T,E]=(0,v.useState)({instituteName:``,adminName:``,username:``,password:``}),[D,O]=(0,v.useState)(!1),[k,A]=(0,v.useState)(``),[j,M]=(0,v.useState)(``),[N,P]=(0,v.useState)(!1),F=h();(0,v.useEffect)(()=>{if(!localStorage.getItem(`superadminToken`)){F(`/superadmin`);return}I();let e=e=>{let t=(e.clientX/window.innerWidth-.5)*30,n=(e.clientY/window.innerHeight-.5)*30;document.documentElement.style.setProperty(`--bg-x`,`${t}px`),document.documentElement.style.setProperty(`--bg-y`,`${n}px`)};return window.addEventListener(`mousemove`,e),()=>window.removeEventListener(`mousemove`,e)},[F]);let I=async()=>{try{let e=localStorage.getItem(`superadminToken`),n=await fetch(`${_}/superadmin/institutes`,{headers:{Authorization:`Bearer ${e}`}});n.ok?t(await n.json()):n.status===401?L():r.error(`Failed to fetch institutes`)}catch{r.error(`Network error fetching institutes`)}b(!1)},L=()=>{localStorage.removeItem(`superadminToken`),F(`/superadmin`)},R=async e=>{e.preventDefault(),O(!0);try{let e=localStorage.getItem(`superadminToken`),t=await fetch(`${_}/superadmin/create-institute`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify(T)}),n=await t.json();t.ok?(r.success(`Institute created successfully!`),S(!1),E({instituteName:``,adminName:``,username:``,password:``}),I()):r.error(n.error||`Failed to create institute`)}catch{r.error(`Network error during creation`)}O(!1)},z=e=>{w(e),M(e.notes||``),A(``)},B=async e=>{if(window.confirm(`Are you absolutely sure you want to permanently delete this institute and its owner account? This cannot be undone.`))try{let t=localStorage.getItem(`superadminToken`),n=await fetch(`${_}/superadmin/institutes/${e}`,{method:`DELETE`,headers:{Authorization:`Bearer ${t}`}});if(n.ok)r.success(`Institute deleted`),w(null),I();else{let e=await n.json();r.error(e.error||`Failed to delete`)}}catch{r.error(`Network error`)}};return n?(0,y.jsxs)(`div`,{className:`superadmin-container loading-state`,children:[(0,y.jsx)(`div`,{className:`loader`}),(0,y.jsx)(`p`,{children:`Initializing Super Admin Secure Portal...`})]}):(0,y.jsxs)(`div`,{className:`superadmin-container`,children:[(0,y.jsx)(`div`,{className:`bg-texture`}),(0,y.jsx)(`div`,{className:`bg-shape shape1`}),(0,y.jsx)(`div`,{className:`bg-shape shape2`}),(0,y.jsxs)(`div`,{className:`superadmin-topbar`,children:[(0,y.jsxs)(`div`,{className:`brand`,children:[(0,y.jsx)(`div`,{className:`brand-icon`,children:(0,y.jsx)(i,{size:28,color:`#2563eb`})}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h2`,{children:`Super Admin Portal`}),(0,y.jsx)(`span`,{className:`badge`,children:`Global Access`})]})]}),(0,y.jsxs)(`button`,{className:`logout-btn`,onClick:L,children:[(0,y.jsx)(f,{size:18}),` Disconnect`]})]}),(0,y.jsxs)(`div`,{className:`superadmin-content`,children:[(0,y.jsxs)(`div`,{className:`content-header`,children:[(0,y.jsxs)(`div`,{className:`header-text`,children:[(0,y.jsx)(`h3`,{children:`Registered Institutes`}),(0,y.jsx)(`p`,{children:`Manage, monitor, and provision all coaching institutes on the SaaS platform.`})]}),(0,y.jsxs)(`button`,{className:`create-btn`,onClick:()=>S(!0),children:[(0,y.jsx)(o,{size:20}),` Add New Institute`]})]}),(0,y.jsx)(`div`,{className:`institutes-grid`,children:e.length===0?(0,y.jsxs)(`div`,{className:`empty-state`,children:[(0,y.jsx)(d,{size:48,opacity:.3,color:`#475569`}),(0,y.jsx)(`p`,{children:`No institutes registered yet. Click 'Add New Institute' to provision your first client.`})]}):e.map(e=>(0,y.jsxs)(`div`,{className:`institute-card`,onClick:()=>z(e),children:[(0,y.jsxs)(`div`,{className:`inst-card-top`,children:[e.logo?(0,y.jsx)(`img`,{src:e.logo,alt:`Logo`,className:`inst-logo`}):(0,y.jsx)(`div`,{className:`inst-logo-placeholder`,children:e.name.charAt(0).toUpperCase()}),(0,y.jsx)(`div`,{className:`status-dot`})]}),(0,y.jsx)(`h4`,{className:`inst-name`,children:e.name}),(0,y.jsxs)(`div`,{className:`inst-details-compact`,children:[(0,y.jsxs)(`div`,{children:[(0,y.jsx)(m,{size:14}),` `,e.adminName]}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(p,{size:14}),` `,new Date(e.createdAt).toLocaleDateString()]})]}),(0,y.jsxs)(`div`,{className:`inst-card-footer`,children:[(0,y.jsx)(`span`,{children:`Manage Details`}),(0,y.jsx)(c,{size:16})]})]},e._id))})]}),x&&(0,y.jsx)(`div`,{className:`modal-overlay glass`,onClick:()=>S(!1),children:(0,y.jsxs)(`div`,{className:`modal-content create-modal`,onClick:e=>e.stopPropagation(),children:[(0,y.jsxs)(`div`,{className:`modal-header`,children:[(0,y.jsx)(`h3`,{children:`Provision New Institute`}),(0,y.jsx)(`button`,{className:`close-btn`,onClick:()=>S(!1),children:(0,y.jsx)(u,{size:24})})]}),(0,y.jsxs)(`form`,{onSubmit:R,children:[(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{children:`Institute Name`}),(0,y.jsx)(`input`,{type:`text`,required:!0,value:T.instituteName,onChange:e=>E({...T,instituteName:e.target.value}),placeholder:`e.g. Apex Classes`})]}),(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{children:`Owner Full Name`}),(0,y.jsx)(`input`,{type:`text`,required:!0,value:T.adminName,onChange:e=>E({...T,adminName:e.target.value}),placeholder:`e.g. Rahul Sharma`})]}),(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{children:`Master Login Username`}),(0,y.jsx)(`input`,{type:`text`,required:!0,value:T.username,onChange:e=>E({...T,username:e.target.value}),placeholder:`e.g. apexadmin`})]}),(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{children:`Temporary Password`}),(0,y.jsx)(`input`,{type:`text`,required:!0,value:T.password,onChange:e=>E({...T,password:e.target.value}),placeholder:`Provide a strong password`})]}),(0,y.jsxs)(`div`,{className:`modal-actions`,children:[(0,y.jsx)(`button`,{type:`button`,className:`cancel-btn`,onClick:()=>S(!1),children:`Cancel`}),(0,y.jsx)(`button`,{type:`submit`,className:`save-btn`,disabled:D,children:D?`Provisioning...`:`Provision Institute`})]})]})]})}),C&&(0,y.jsx)(`div`,{className:`modal-overlay glass`,onClick:()=>w(null),children:(0,y.jsxs)(`div`,{className:`modal-content detail-modal`,onClick:e=>e.stopPropagation(),children:[(0,y.jsxs)(`div`,{className:`modal-header`,children:[(0,y.jsxs)(`div`,{className:`detail-title`,children:[C.logo?(0,y.jsx)(`img`,{src:C.logo,alt:`Logo`,className:`detail-logo`}):(0,y.jsx)(`div`,{className:`detail-logo-placeholder`,children:(0,y.jsx)(d,{size:20})}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h3`,{children:C.name}),(0,y.jsxs)(`span`,{className:`inst-id`,children:[`ID: `,C._id]})]})]}),(0,y.jsx)(`button`,{className:`close-btn`,onClick:()=>w(null),children:(0,y.jsx)(u,{size:24})})]}),(0,y.jsxs)(`div`,{className:`detail-body`,children:[(0,y.jsxs)(`div`,{className:`info-grid`,children:[(0,y.jsxs)(`div`,{className:`info-box`,children:[(0,y.jsx)(`span`,{className:`label`,children:`Owner Name`}),(0,y.jsx)(`span`,{className:`value`,children:C.adminName})]}),(0,y.jsxs)(`div`,{className:`info-box`,children:[(0,y.jsx)(`span`,{className:`label`,children:`Username`}),(0,y.jsx)(`span`,{className:`value highlight`,children:C.username})]}),(0,y.jsxs)(`div`,{className:`info-box`,children:[(0,y.jsx)(`span`,{className:`label`,children:`Joined Date`}),(0,y.jsx)(`span`,{className:`value`,children:new Date(C.createdAt).toLocaleDateString()})]}),(0,y.jsxs)(`div`,{className:`info-box`,children:[(0,y.jsx)(`span`,{className:`label`,children:`Status`}),(0,y.jsx)(`span`,{className:`value status-active`,children:`Active`})]})]}),(0,y.jsxs)(`div`,{className:`section-box password-section`,children:[(0,y.jsxs)(`h4`,{children:[(0,y.jsx)(g,{size:18}),` Reset Owner Password`]}),(0,y.jsx)(`p`,{children:`Generate a new password for the institute owner if they lose access.`}),(0,y.jsxs)(`form`,{onSubmit:async e=>{if(e.preventDefault(),!k||k.length<6){r.error(`Password must be at least 6 characters`);return}try{let e=localStorage.getItem(`superadminToken`),t=await fetch(`${_}/superadmin/institutes/${C._id}/reset-password`,{method:`PUT`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({newPassword:k})});if(t.ok)r.success(`Password reset successfully`),A(``);else{let e=await t.json();r.error(e.error||`Failed to reset password`)}}catch{r.error(`Network error`)}},className:`reset-form`,children:[(0,y.jsx)(`input`,{type:`text`,placeholder:`Enter new password`,value:k,onChange:e=>A(e.target.value)}),(0,y.jsx)(`button`,{type:`submit`,className:`reset-btn`,children:`Update Password`})]})]}),(0,y.jsxs)(`div`,{className:`section-box notes-section`,children:[(0,y.jsxs)(`div`,{className:`section-header`,children:[(0,y.jsxs)(`h4`,{children:[(0,y.jsx)(s,{size:18}),` Admin Private Notes`]}),(0,y.jsxs)(`button`,{onClick:async()=>{P(!0);try{let e=localStorage.getItem(`superadminToken`),t=await fetch(`${_}/superadmin/institutes/${C._id}/notes`,{method:`PUT`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({notes:j})});if(t.ok)r.success(`Notes saved`),I();else{let e=await t.json();r.error(e.error||`Failed to save notes`)}}catch{r.error(`Network error`)}P(!1)},disabled:N,className:`save-notes-btn`,children:[(0,y.jsx)(a,{size:16}),` `,N?`Saving...`:`Save Notes`]})]}),(0,y.jsx)(`p`,{children:`Keep track of payments, renewals, and custom agreements here. (Not visible to the client)`}),(0,y.jsx)(`textarea`,{value:j,onChange:e=>M(e.target.value),placeholder:`e.g. Paid Rs 5000 for 1 year plan on 25 July 2026. Next renewal due in 2027.`,rows:`4`})]}),(0,y.jsxs)(`div`,{className:`section-box danger-zone`,children:[(0,y.jsx)(`h4`,{children:`Danger Zone`}),(0,y.jsx)(`p`,{children:`Permanently remove this institute and revoke all access. This action cannot be reversed.`}),(0,y.jsxs)(`button`,{onClick:()=>B(C._id),className:`delete-btn`,children:[(0,y.jsx)(l,{size:18}),` Delete Institute`]})]})]})]})}),(0,y.jsx)(`style`,{children:`
        :root {
          --bg-x: 0px;
          --bg-y: 0px;
        }
        
        .superadmin-container {
          min-height: 100vh;
          background-color: #f0f9ff; /* Light Sky Blue */
          background-image: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
          color: #0f172a; /* Dark text for high contrast */
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* Interactive Texture Background */
        .bg-texture {
          position: fixed;
          top: -50px; left: -50px; right: -50px; bottom: -50px;
          background-image: radial-gradient(#94a3b8 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.4;
          z-index: 0;
          transform: translate(var(--bg-x), var(--bg-y));
          transition: transform 0.1s ease-out;
          pointer-events: none;
        }
        
        /* Loading */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #0f172a;
        }
        .loader {
          border: 4px solid rgba(15, 23, 42, 0.1);
          border-left-color: #2563eb;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Dynamic Background Shapes */
        .bg-shape {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          z-index: 0;
          opacity: 0.6;
        }
        .shape1 {
          width: 500px;
          height: 500px;
          background: #7dd3fc;
          top: -100px;
          right: -100px;
        }
        .shape2 {
          width: 600px;
          height: 600px;
          background: #bfdbfe;
          bottom: -200px;
          left: -100px;
        }

        /* Topbar */
        .superadmin-topbar {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 40px;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .brand-icon {
          background: rgba(37, 99, 235, 0.1);
          padding: 10px;
          border-radius: 12px;
          display: flex;
        }
        .brand h2 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .badge {
          font-size: 0.7rem;
          background: #2563eb;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .logout-btn:hover {
          background: #f1f5f9;
          color: #ef4444;
          border-color: #ef4444;
        }

        /* Content */
        .superadmin-content {
          position: relative;
          z-index: 10;
          padding: 40px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }
        .header-text h3 {
          margin: 0 0 8px 0;
          font-size: 2.2rem;
          font-weight: 800;
          color: #0f172a;
        }
        .header-text p {
          margin: 0;
          color: #475569;
          font-size: 1.1rem;
          font-weight: 500;
        }
        .create-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: white;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
        }
        .create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.5);
        }

        /* Grid */
        .institutes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px;
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(10px);
          border: 1px dashed #94a3b8;
          border-radius: 24px;
          color: #475569;
          gap: 16px;
          font-weight: 500;
        }
        
        /* Card */
        .institute-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
        }
        .institute-card:hover {
          transform: translateY(-8px);
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(255,255,255,1);
          box-shadow: 0 25px 50px -15px rgba(37, 99, 235, 0.2);
        }
        .inst-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .inst-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
          background: white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .inst-logo-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.4rem;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        }
        .inst-name {
          margin: 0 0 12px 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
        }
        .inst-details-compact {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
          flex-grow: 1;
        }
        .inst-details-compact div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .inst-details-compact svg {
          color: #94a3b8;
        }
        .inst-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.05);
          color: #2563eb;
          font-size: 0.95rem;
          font-weight: 600;
          transition: 0.2s;
        }
        .institute-card:hover .inst-card-footer {
          color: #1d4ed8;
          padding-right: 5px; /* slight animation */
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4); /* Dark semi-transparent */
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-overlay.glass {
          backdrop-filter: blur(12px);
        }
        .modal-content {
          background: white;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.8);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 40px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }
        .create-modal {
          width: 100%;
          max-width: 500px;
          padding: 32px;
        }
        .detail-modal {
          width: 100%;
          max-width: 750px;
        }
        
        /* Modal Header */
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.6rem;
          font-weight: 700;
          color: #0f172a;
        }
        .close-btn {
          background: white;
          border: 1px solid #cbd5e1;
          color: #64748b;
          width: 40px; height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .close-btn:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }

        /* Detail Modal specific */
        .detail-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .detail-logo, .detail-logo-placeholder {
          width: 48px; height: 48px;
          border-radius: 12px;
        }
        .detail-logo-placeholder {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex; align-items: center; justify-content: center;
          color: white;
        }
        .inst-id {
          font-size: 0.85rem;
          color: #64748b;
          font-family: monospace;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
          margin-top: 4px;
          display: inline-block;
        }

        .detail-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: white;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .info-box {
          background: #f8fafc;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .info-box .label {
          color: #64748b;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .info-box .value {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .info-box .value.highlight {
          color: #2563eb;
        }
        .status-active {
          color: #059669 !important;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-active::before {
          content: '';
          display: block;
          width: 10px; height: 10px;
          background: #10b981;
          border-radius: 50%;
        }

        /* Sections */
        .section-box {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }
        .section-box h4 {
          margin: 0 0 8px 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-box p {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .section-header h4 { margin: 0; }

        /* Forms inside modals */
        .reset-form {
          display: flex;
          gap: 16px;
        }
        .reset-form input {
          flex-grow: 1;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 1rem;
          color: #0f172a;
          transition: 0.2s;
        }
        .reset-form input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          background: white;
        }
        .reset-btn {
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          padding: 0 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          white-space: nowrap;
        }
        .reset-btn:hover {
          background: #0f172a;
          color: white;
          border-color: #0f172a;
        }

        .save-notes-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: 0.2s;
        }
        .save-notes-btn:hover {
          background: #d1fae5;
        }

        textarea {
          width: 100%;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          padding: 20px;
          color: #0f172a;
          resize: vertical;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.5;
          transition: 0.2s;
        }
        textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          background: white;
        }

        /* Danger Zone */
        .danger-zone {
          border-color: #fecaca;
          background: #fef2f2;
        }
        .danger-zone h4 {
          color: #dc2626;
        }
        .delete-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: white;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 12px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: 0.2s;
          box-shadow: 0 2px 5px rgba(220, 38, 38, 0.05);
        }
        .delete-btn:hover {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
        }

        /* Create Form */
        .form-group { margin-bottom: 24px; }
        .form-group label {
          display: block; margin-bottom: 10px;
          color: #475569; font-size: 0.95rem; font-weight: 600;
        }
        .form-group input {
          width: 100%;
          padding: 14px 18px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          color: #0f172a;
          font-size: 1rem;
          transition: 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          background: white;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.1);
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 40px;
        }
        .cancel-btn, .save-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          transition: 0.2s;
        }
        .cancel-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
        }
        .cancel-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .save-btn {
          background: #2563eb;
          border: none;
          color: white;
          box-shadow: 0 4px 12px rgba(37,99,235,0.2);
        }
        .save-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }
      `})]})}export{b as default};