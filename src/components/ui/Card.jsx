export function Card({ children, className = '', hover = false, onClick, ...props }) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-md
        ${hover ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}
        ${onClick ? 'text-left w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-4 border-b ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`p-4 border-t bg-gray-50 rounded-b-xl ${className}`}>
      {children}
    </div>
  )
}

export default Card
