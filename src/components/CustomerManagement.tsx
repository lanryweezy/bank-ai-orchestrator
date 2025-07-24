
import React, { useState, useEffect } from 'react';
import GenericCard from './GenericCard';
import { Button } from '@/components/ui/button';
import AddCustomerModal from './AddCustomerModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  CreditCard,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

import { Customer } from '@/types/customer';

import { mockCustomers } from '@/data/mockCustomers';
import apiClient from '@/services/apiClient';

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        // const data = await apiClient<Customer[]>('/customers');
        // setCustomers(data);
        setCustomers(mockCustomers); // Using mock data for now
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  /**
   * Returns the color for the status badge based on the status.
   * @param status The status of the customer.
   * @returns The color for the status badge.
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Returns the icon for the status badge based on the status.
   * @param status The status of the customer.
   * @returns The icon for the status badge.
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'rejected': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const handleCustomerAdded = (newCustomer: Customer) => {
    setCustomers(prevCustomers => [newCustomer, ...prevCustomers]);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const [activeTab, setActiveTab] = useState('customers');

  const filteredCustomers = customers
    .filter(customer => {
      if (activeTab === 'kyc-pending') {
        return customer.kycStatus === 'pending';
      }
      return true;
    })
    .filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.bvn.includes(searchTerm) ||
      customer.accountNumber.includes(searchTerm)
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        <AddCustomerModal onCustomerAdded={handleCustomerAdded} />
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
          <Input
            placeholder="Search customers by name, BVN, or account number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline">
          <Shield className="h-4 w-4 mr-2" />
          KYC Review
        </Button>
      </div>

      <Tabs defaultValue="customers" className="w-full" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customers">All Customers</TabsTrigger>
          <TabsTrigger value="kyc-pending">KYC Pending</TabsTrigger>
          <TabsTrigger value="onboarding">New Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <GenericCard
                key={customer.id}
                title={customer.name}
                subtitle={customer.accountNumber}
                icon={<Users className="h-5 w-5 text-blue-600" />}
                status={customer.kycStatus}
                statusColor={getStatusColor(customer.kycStatus)}
              >
                <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{customer.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <span>BVN: {customer.bvn}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Balance</p>
                        <p className="font-semibold">{formatCurrency(customer.balance)}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(customer.kycStatus)}>
                          {customer.kycStatus}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{customer.accountTier}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Edit
                    </Button>
                  </div>
              </GenericCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kyc-pending">
          <Card>
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-medium mb-2">KYC Pending Review</h3>
              <p className="text-gray-600 mb-4">2 customers pending KYC verification</p>
              <Button className="banking-gradient text-white">
                Review Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding">
          <Card>
            <CardContent className="p-6 text-center">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-medium mb-2">Customer Onboarding</h3>
              <p className="text-gray-600 mb-4">Start the automated onboarding process</p>
              <Button className="banking-gradient text-white">
                Start Onboarding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerManagement;
