import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{d as t}from"./vendor-charts-ByRd4wAk.js";import{Et as n,Ot as r}from"./vendor-core-CcSwyHZw.js";import{D as i,Nt as a,Pt as o,u as s,wn as c}from"./vendor-react-DXAjuTxV.js";import{i as l}from"./index-Dv7piMz6.js";var u=e(t(),1),d=n();function f(){let[e,t]=(0,u.useState)(``),[n,f]=(0,u.useState)(``),[p,m]=(0,u.useState)(!1),[h,g]=(0,u.useState)(!1),_=c();return(0,d.jsxs)(`div`,{className:`login-container`,children:[(0,d.jsxs)(`div`,{className:`login-box`,style:{borderTop:`4px solid #ef4444`},children:[(0,d.jsxs)(`div`,{className:`login-header`,children:[(0,d.jsx)(`div`,{className:`logo-icon-login`,style:{background:`none`,width:`auto`,height:`auto`,marginBottom:`16px`},children:(0,d.jsx)(i,{size:64,color:`#ef4444`})}),(0,d.jsx)(`h2`,{children:`SUPER ADMIN`}),(0,d.jsx)(`p`,{children:`Global Security & Provisioning`})]}),(0,d.jsxs)(`form`,{onSubmit:async t=>{t.preventDefault(),g(!0);try{let t=await fetch(`${l}/superadmin/login`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({username:e,password:n})}),i=await t.json();t.ok?(localStorage.setItem(`superadminToken`,i.token),r.success(`Super Admin Login Successful!`),_(`/superadmin/dashboard`)):r.error(i.error||`Login failed`)}catch{r.error(`Network error`)}g(!1)},className:`login-form`,children:[(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Master Username`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(s,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:`text`,placeholder:`Enter master username`,value:e,onChange:e=>t(e.target.value),required:!0})]})]}),(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Master Password`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(i,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:p?`text`:`password`,placeholder:`Enter master password`,value:n,onChange:e=>f(e.target.value),required:!0}),(0,d.jsx)(`button`,{type:`button`,onClick:()=>m(!p),style:{position:`absolute`,right:`14px`,top:`50%`,transform:`translateY(-50%)`,background:`none`,border:`none`,cursor:`pointer`,color:`#64748b`,display:`flex`,alignItems:`center`,padding:0},children:p?(0,d.jsx)(o,{size:18}):(0,d.jsx)(a,{size:18})})]})]}),(0,d.jsx)(`button`,{type:`submit`,className:`login-btn`,style:{background:`#ef4444`},disabled:h,children:h?`Authenticating...`:`Authorize Access`})]})]}),(0,d.jsx)(`style`,{children:`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          padding: 20px;
        }
        .login-box {
          background: #1e293b;
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-header h2 {
          color: #f8fafc;
          font-size: 1.5rem;
          margin: 0 0 8px 0;
          font-weight: 600;
        }
        .login-header p {
          color: #94a3b8;
          font-size: 0.95rem;
          margin: 0;
        }
        .input-group {
          margin-bottom: 20px;
        }
        .input-group label {
          display: block;
          color: #cbd5e1;
          font-size: 0.9rem;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .input-with-icon {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        .input-with-icon input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          color: #f8fafc;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .input-with-icon input:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `})]})}export{f as default};