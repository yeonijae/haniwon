// Desktop notification utility

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
}

class NotificationService {
  private permission: NotificationPermission = 'default';

  async init(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return;
    }

    this.permission = Notification.permission;

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }
  }

  isEnabled(): boolean {
    return this.permission === 'granted';
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    this.permission = await Notification.requestPermission();
    return this.permission === 'granted';
  }

  show(options: NotificationOptions): void {
    if (!this.isEnabled()) return;

    // Don't show notification if window is focused
    if (document.hasFocus()) return;

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon.png',
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }
}

export const notificationService = new NotificationService();
