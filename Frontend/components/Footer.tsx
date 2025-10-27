import { Vote } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <span className="text-white">VoteFHE</span>
            </div>
            <p className="text-gray-400 text-sm">
              Decentralized voting platform with FHE technology, ensuring
              absolute privacy and transparency.
            </p>
          </div>

          <div>
            <h3 className="text-white mb-4">Product</h3>
            <div className="space-y-2 text-sm">
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Create Room
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Join Voting
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                View Results
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white mb-4">Technology</h3>
            <div className="space-y-2 text-sm">
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                FHE Encryption
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Blockchain
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Smart Contracts
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white mb-4">Support</h3>
            <div className="space-y-2 text-sm">
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                FAQ
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors block"
              >
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700/50 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 VoteFHE. All rights reserved. Built with ❤️ and blockchain
            technology.
          </p>
        </div>
      </div>
    </footer>
  );
}
