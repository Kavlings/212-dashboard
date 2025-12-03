import type React from "react";

interface CardProps {
    title?:string;
    children: React.ReactNode
    style?: React.CSSProperties;
}

function Card({title, children, style}: CardProps){
    const cardStyle: React.CSSProperties = {
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        margin: '20px auto',
        maxWidth: '600px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3',
        ...style,
    };

    return (
        <div style={cardStyle}>
            {title && <h3 style={{marginTop:0, marginBottom: '10px'}}>{title}</h3>}
            {children}
        </div>

    )

}

export default Card;