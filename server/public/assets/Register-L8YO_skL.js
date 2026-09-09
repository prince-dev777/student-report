import{o as e}from"./rolldown-runtime-CMxvf4Kt.js";import{d as t}from"./vendor-charts-ByRd4wAk.js";import{Et as n}from"./vendor-core-CcSwyHZw.js";import{Cn as r,E as i,_n as a,p as o,sn as s,u as c}from"./vendor-react-BlcsVDUW.js";import{r as l}from"./index-Bf0JtXEL.js";var u=e(t(),1),d=n();function f(){let[e,t]=(0,u.useState)(``),[n,f]=(0,u.useState)(``),[p,m]=(0,u.useState)(``),[h,g]=(0,u.useState)(``),[_,v]=(0,u.useState)(!1),{register:y}=l(),b=r();return(0,d.jsxs)(`div`,{className:`login-container`,children:[(0,d.jsxs)(`div`,{className:`login-box`,style:{maxWidth:`480px`},children:[(0,d.jsxs)(`div`,{className:`login-header`,children:[(0,d.jsx)(`div`,{className:`logo-icon-login`,children:(0,d.jsx)(s,{size:32,color:`#ffffff`})}),(0,d.jsx)(`h2`,{children:`Register Institute`}),(0,d.jsx)(`p`,{children:`Create your coaching admin account`})]}),(0,d.jsxs)(`form`,{onSubmit:async t=>{t.preventDefault(),v(!0),await y(e,n,p,h)&&b(`/`),v(!1)},className:`login-form`,children:[(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Institute Name`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(s,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:`text`,placeholder:`e.g. Career Xone`,value:e,onChange:e=>t(e.target.value),required:!0})]})]}),(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Your Name (Admin)`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(o,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:`text`,placeholder:`Enter your full name`,value:n,onChange:e=>f(e.target.value),required:!0})]})]}),(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Admin Username`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(c,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:`text`,placeholder:`Choose a username`,value:p,onChange:e=>m(e.target.value),required:!0})]})]}),(0,d.jsxs)(`div`,{className:`input-group`,children:[(0,d.jsx)(`label`,{children:`Admin Password`}),(0,d.jsxs)(`div`,{className:`input-with-icon`,children:[(0,d.jsx)(i,{size:18,className:`input-icon`}),(0,d.jsx)(`input`,{type:`password`,placeholder:`Create a password`,value:h,onChange:e=>g(e.target.value),required:!0})]})]}),(0,d.jsx)(`button`,{type:`submit`,className:`login-btn`,disabled:_,children:_?`Creating Account...`:`Register Institute`}),(0,d.jsxs)(`p`,{className:`auth-link`,children:[`Already registered? `,(0,d.jsx)(a,{to:`/login`,children:`Login here`})]})]})]}),(0,d.jsx)(`style`,{children:`
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
          max-width: 480px;
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
          padding: 12px 16px 12px 42px;
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
      `})]})}export{f as default};