import { useState, useEffect } from 'react';
import { useServerConfigStore } from '../../stores/serverConfigStore';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServerSettingsModal({ isOpen, onClose }: ServerSettingsModalProps) {
  const { serverUrl, serverPort, setServerConfig, resetToDefault, getApiUrl } = useServerConfigStore();
  const [url, setUrl] = useState(serverUrl);
  const [port, setPort] = useState(serverPort);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(serverUrl);
      setPort(serverPort);
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [isOpen, serverUrl, serverPort]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const testUrl = `http://${url}:${port}/health`;
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        setTestStatus('success');
        setTestMessage(`연결 성공! 서버 버전: ${data.version || 'unknown'}`);
      } else {
        setTestStatus('error');
        setTestMessage(`서버 응답 오류: ${response.status}`);
      }
    } catch (error) {
      setTestStatus('error');
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          setTestMessage('연결 시간 초과 (5초)');
        } else {
          setTestMessage(`연결 실패: ${error.message}`);
        }
      } else {
        setTestMessage('연결 실패');
      }
    }
  };

  const handleSave = () => {
    setServerConfig({ serverUrl: url, serverPort: port });
    onClose();
    // Reload to apply new settings
    window.location.reload();
  };

  const handleReset = () => {
    resetToDefault();
    setUrl('localhost');
    setPort('3300');
    setTestStatus('idle');
    setTestMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6">서버 설정</h2>

        <div className="space-y-4">
          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              서버 주소
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="localhost 또는 192.168.0.100"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Server Port */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              포트
            </label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="3300"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preview URL */}
          <div className="text-sm text-gray-400 bg-gray-900 rounded p-3">
            <div className="font-medium text-gray-300 mb-1">API URL:</div>
            <div className="font-mono text-xs break-all">http://{url}:{port}/api/v1</div>
          </div>

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors"
            >
              {testStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
            </button>

            {testMessage && (
              <div className={`mt-2 text-sm ${
                testStatus === 'success' ? 'text-green-400' :
                testStatus === 'error' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {testMessage}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            기본값
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
