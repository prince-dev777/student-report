import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{d as t}from"./vendor-charts-ByRd4wAk.js";import{Et as n}from"./vendor-core-CcSwyHZw.js";import{Dn as r,Ft as i,It as a,k as o,u as s}from"./vendor-react-Du3guypW.js";import{r as c}from"./index-CUeH1Fc4.js";var l=e(t(),1),u=n();function d(){let[e,t]=(0,l.useState)(``),[n,d]=(0,l.useState)(``),[f,p]=(0,l.useState)(!1),[m,h]=(0,l.useState)(!1),{login:g}=c(),_=r();return(0,u.jsxs)(`div`,{className:`login-container`,children:[(0,u.jsxs)(`div`,{className:`login-box`,children:[(0,u.jsxs)(`div`,{className:`login-header`,children:[(0,u.jsx)(`div`,{className:`logo-icon-login`,style:{background:`none`,width:`auto`,height:`auto`,marginBottom:`16px`},children:(0,u.jsx)(`img`,{src:`./logo.jpg`,alt:`Logo`,style:{width:`80px`,height:`80px`,borderRadius:`16px`,objectFit:`contain`}})}),(0,u.jsx)(`h2`,{children:`CAREER XONE`}),(0,u.jsx)(`p`,{children:`Admin Security Portal`})]}),(0,u.jsxs)(`form`,{onSubmit:async t=>{t.preventDefault(),h(!0),await g(e,n)&&_(`/`),h(!1)},className:`login-form`,children:[(0,u.jsxs)(`div`,{className:`input-group`,children:[(0,u.jsx)(`label`,{children:`Username`}),(0,u.jsxs)(`div`,{className:`input-with-icon`,children:[(0,u.jsx)(s,{size:18,className:`input-icon`}),(0,u.jsx)(`input`,{type:`text`,placeholder:`Enter admin username`,value:e,onChange:e=>t(e.target.value),required:!0})]})]}),(0,u.jsxs)(`div`,{className:`input-group`,children:[(0,u.jsx)(`label`,{children:`Password`}),(0,u.jsxs)(`div`,{className:`input-with-icon`,children:[(0,u.jsx)(o,{size:18,className:`input-icon`}),(0,u.jsx)(`input`,{type:f?`text`:`password`,placeholder:`Enter password`,value:n,onChange:e=>d(e.target.value),required:!0}),(0,u.jsx)(`button`,{type:`button`,onClick:()=>p(!f),style:{position:`absolute`,right:`14px`,top:`50%`,transform:`translateY(-50%)`,background:`none`,border:`none`,cursor:`pointer`,color:`#64748b`,display:`flex`,alignItems:`center`,padding:0},children:f?(0,u.jsx)(a,{size:18}):(0,u.jsx)(i,{size:18})})]})]}),(0,u.jsx)(`button`,{type:`submit`,className:`login-btn`,disabled:m,children:m?`Authenticating...`:`Secure Login`})]})]}),(0,u.jsx)(`style`,{children:`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f5fc;
          background-image: 
            radial-gradient(ellipse at 20% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(124, 58, 237, 0.05) 0%, transparent 50%);
        }
        .login-box {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(37, 99, 235, 0.15);
          padding: 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.12);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-icon-login {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #2563eb, #6366f1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
        }
        .login-header h2 {
          color: #0f172a;
          font-size: 1.8rem;
          margin-bottom: 4px;
        }
        .login-header p {
          color: #475569;
          font-size: 0.9rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .input-group label {
          display: block;
          color: #475569;
          font-size: 0.85rem;
          margin-bottom: 8px;
          font-weight: 600;
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
          background: #ffffff;
          border: 1px solid rgba(37, 99, 235, 0.15);
          padding: 12px 42px 12px 42px;
          border-radius: 12px;
          color: #0f172a;
          font-size: 0.95rem;
          transition: all 0.25s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.04);
        }
        .input-with-icon input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }
        .input-with-icon input::placeholder {
          color: #94a3b8;
        }
        .login-btn {
          margin-top: 10px;
          background: linear-gradient(135deg, #2563eb, #6366f1);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.2);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-link {
          text-align: center;
          margin-top: 15px;
          color: #64748b;
          font-size: 0.9rem;
        }
        .auth-link a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }
        .auth-link a:hover {
          text-decoration: underline;
        }
      `})]})}export{d as default};