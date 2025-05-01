// packages/popup/src/components/Button/Button.tsx
import React, { type ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement | HTMLAnchorElement> {
    children: ReactNode;
    href?: string; // If it's a link
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'; // Added ghost variant for header potentially
    size?: 'normal' | 'large';
    className?: string;
    target?: string; // Allow target attribute for links
    rel?: string; // Allow rel attribute for links
}

const Button: React.FC<ButtonProps> = ({
    children,
    href,
    variant = 'primary',
    size = 'normal',
    className = '',
    target, // Pass target prop
    rel, // Pass rel prop
    ...props // Spread remaining props (like onClick, disabled, etc.)
}) => {
    const buttonClasses = [
        styles.btn,
        styles[variant],
        styles[size],
        className
    ].filter(Boolean).join(' ');

    const commonProps = {
        className: buttonClasses,
        ...props // Pass down other props like disabled, onClick
    };

    if (href) {
        // Ensure target and rel are added correctly for links
        return (
            <a href={href} target={target} rel={rel} {...commonProps}>
                {children}
            </a>
        );
    }

    // Default type to "button" if not specified, to prevent accidental form submissions
    const buttonType = props.type || 'button';

    return (
        <button type={buttonType} {...commonProps}>
            {children}
        </button>
    );
};

export default Button;
