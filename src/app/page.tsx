export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          Hierarchical Permission System
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Demonstrating CQRS, Event Sourcing, and Closure Table patterns for scalable RBAC
        </p>

        <div className="mt-8 flex flex-col items-center space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">🔑 Test Accounts</h2>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium">National Admin:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">admin@ekko.earth</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">London Manager:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">london.manager@ekko.earth</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Manchester Manager:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">manchester.manager@ekko.earth</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Westminster Staff:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">westminster.staff@ekko.earth</code>
              </div>
              <div className="text-center pt-2 border-t">
                <span className="text-gray-600">Password for all accounts: </span>
                <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">Password123!</code>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/api/graphql"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              🚀 GraphQL Playground
            </a>
            <a
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              🔐 Login & Test Permissions
            </a>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-3">🏗️ Architecture</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Domain-Driven Design</li>
              <li>• CQRS + Event Sourcing</li>
              <li>• Closure Table Pattern</li>
              <li>• Materialized Views</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-3">⚡ Performance</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• O(1) permission queries</li>
              <li>• Intelligent data source routing</li>
              <li>• Optimized for 100k+ users/day</li>
              <li>• Real-time consistency options</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-3">🔧 Tech Stack</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Next.js 14 + TypeScript</li>
              <li>• GraphQL + Apollo Server</li>
              <li>• Prisma ORM + SQLite</li>
              <li>• Tailwind CSS</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-800 mb-2">
            📋 Hierarchy Structure
          </h3>
          <div className="text-sm text-amber-700">
            <div className="font-mono">
              National Office (Level 2)<br />
              ├── London Office (Level 1)<br />
              │   ├── Westminster Branch (Level 0)<br />
              │   └── Camden Branch (Level 0)<br />
              └── Manchester Office (Level 1)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;└── City Centre Branch (Level 0)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
