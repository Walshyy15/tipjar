import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="w-full flex items-center justify-center p-8">
      <div className="card w-full max-w-md">
        <div className="card-header flex items-center">
          <AlertCircle className="h-6 w-6 mr-2 text-[#dd7895]" />
          <div className="text-2xl font-semibold tracking-tight text-[#f5f5f5]">
            404 Page Not Found
          </div>
        </div>
        
        <div className="card-body">
          <p className="text-[#f5f5f5]">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="mt-6">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); window.location.href='/' }}
              className="btn btn-primary"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
