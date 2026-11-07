import React from 'react';
import { PhoneOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { forceStopNativeAndroidScreenShare } from '../utils/mobileScreenShare';
import { clearCallSystemNotifications } from '../utils/notifications';

interface CallErrorBoundaryProps {
  children: React.ReactNode;
  onForceEndCall: () => void;
}

interface CallErrorBoundaryState {
  hasError: boolean;
}

export class CallErrorBoundary extends React.Component<
  CallErrorBoundaryProps,
  CallErrorBoundaryState
> {
  constructor(props: CallErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): CallErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('CallErrorBoundary caught error:', error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false });
  };

  handleForceEnd = () => {
    forceStopNativeAndroidScreenShare();
    clearCallSystemNotifications();
    this.setState({ hasError: false });
    this.props.onForceEndCall();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ zIndex: 9999 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 bg-[#16202d]/98 border border-rose-500/40 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-[94vw] text-white"
        >
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">Восстановление окна звонка</div>
            <div className="text-[11px] text-[#8fa2b7] truncate">
              Вы можете развернуть звонок или завершить его
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={this.handleRecover}
              className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Развернуть</span>
            </button>
            <button
              type="button"
              onClick={this.handleForceEnd}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <PhoneOff size={13} />
              <span>Завершить</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
