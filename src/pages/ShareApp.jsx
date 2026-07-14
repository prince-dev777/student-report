import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Smartphone, Link as LinkIcon, MessageCircle, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareApp() {
  const { students, sendBulkManualSMS } = useApp();
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  // Define the app download link (This can be updated later)
  const appLink = "https://expo.dev/accounts/myrentalaap/projects/career-xone-parent/builds/b719907b-68c3-4f54-b987-43b203a4fe81";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToAll = async () => {
    if (students.length === 0) {
      toast.error("No students found to send the link!");
      return;
    }

    const confirmSend = window.confirm(`Are you sure you want to send the Parents App link via WhatsApp to all ${students.length} parents?`);
    
    if (confirmSend) {
      setIsSending(true);
      try {
        const studentIds = students.map(s => s.id);
        const instituteName = user?.instituteName || 'Career Xone Pro';
        
        const message = `Dear Parent, please download our Institute's official App to track your child's Attendance and Marks.\n\nDownload Link: ${appLink}\n\nYour Login ID: {{rollNo}}\nPassword: {{password}}\n\nRegards,\n${instituteName}`;
        
        await sendBulkManualSMS(studentIds, message);
      } catch (error) {
        toast.error("Failed to send links.");
        console.error(error);
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Share Parents App</h1>
          <p className="text-sm text-gray-500 mt-1">Distribute your branded Parents App easily</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
            <Smartphone className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Scan to Download</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Parents can scan this QR code with their mobile phone camera to instantly open and install the app.
          </p>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 my-4 inline-block">
            <QRCodeSVG value={appLink} size={200} level="H" includeMargin={true} />
          </div>
          
          <p className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full mt-2">
            Tip: Print this QR code and put it on your notice board
          </p>
        </div>

        {/* WhatsApp & Link Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col space-y-6">
          
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Direct App Link</h2>
            <p className="text-sm text-gray-500">Copy this link to share manually anywhere.</p>
            
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 truncate">
                {appLink}
              </div>
              <button 
                onClick={handleCopyLink}
                className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors flex items-center"
                title="Copy Link"
              >
                {copied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100 w-full"></div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Blast to All Parents</h2>
            <p className="text-sm text-gray-500">
              Instantly send a WhatsApp message to all <b>{students.length}</b> registered parents containing the app download link and their login credentials.
            </p>
            
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-4">
              <p className="text-xs text-green-800 font-medium mb-2">Message Preview:</p>
              <p className="text-sm text-gray-700 italic">
                "Dear Parent, please download our Institute's official App to track your child's Attendance and Marks... Link: {appLink}"
              </p>
            </div>

            <button
              onClick={handleSendToAll}
              disabled={isSending || students.length === 0}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                isSending || students.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md'
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              <span>{isSending ? 'Sending to all parents...' : 'Send Link via WhatsApp'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
